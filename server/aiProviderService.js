import * as db from './database.js'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_AZURE_API_VERSION = '2024-02-01'
const DEFAULT_CHAT_TIMEOUT_MS = 90_000
const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 10 * 60_000

function cleanBaseUrl(url, fallback = '') {
  if (!url || typeof url !== 'string') {
    return fallback
  }
  return url.replace(/\/$/, '')
}

function parseErrorMessage(responseBody, fallbackMessage) {
  if (!responseBody) {
    return fallbackMessage
  }

  try {
    const json = JSON.parse(responseBody)
    if (json?.error?.message) {
      return json.error.message
    }
    if (json?.message) {
      return json.message
    }
  } catch (_e) {
    // Not JSON, fall back to raw text below.
  }

  return responseBody.slice(0, 500) || fallbackMessage
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function parseJsonResponse(response, fallbackMessage) {
  if (response.ok) {
    return response.json()
  }
  const errorText = await response.text()
  const errorMessage = parseErrorMessage(
    errorText,
    `${fallbackMessage}: ${response.status} ${response.statusText}`
  )
  throw new Error(errorMessage)
}

function getEnvProviderFallback() {
  if (process.env.AI_PROVIDER === 'openai' || process.env.OPENAI_API_KEY) {
    return 'openai'
  }
  return 'azure'
}

function getSettingsWithEnvFallback(userId) {
  const settings = db.getSettings(userId) || {}
  const provider =
    settings.provider === 'openai' ? 'openai' : getEnvProviderFallback()

  if (provider === 'openai') {
    return {
      provider: 'openai',
      azureEndpoint: '',
      openaiBaseUrl: cleanBaseUrl(
        settings.openai_base_url || process.env.OPENAI_BASE_URL,
        DEFAULT_OPENAI_BASE_URL
      ),
      apiKey: settings.api_key || process.env.OPENAI_API_KEY || '',
      apiVersion:
        settings.api_version ||
        process.env.AZURE_OPENAI_API_VERSION ||
        DEFAULT_AZURE_API_VERSION,
      whisperDeployment:
        settings.whisper_deployment ||
        process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ||
        'whisper',
      gptDeployment:
        settings.gpt_deployment ||
        process.env.AZURE_OPENAI_GPT_DEPLOYMENT ||
        'gpt-4',
      openaiWhisperModel:
        settings.openai_whisper_model ||
        process.env.OPENAI_WHISPER_MODEL ||
        'whisper-1',
      openaiGptModel:
        settings.openai_gpt_model || process.env.OPENAI_GPT_MODEL || 'gpt-4o'
    }
  }

  return {
    provider: 'azure',
    azureEndpoint: cleanBaseUrl(
      settings.azure_endpoint || process.env.AZURE_OPENAI_ENDPOINT,
      ''
    ),
    openaiBaseUrl: cleanBaseUrl(
      settings.openai_base_url || process.env.OPENAI_BASE_URL,
      DEFAULT_OPENAI_BASE_URL
    ),
    apiKey: settings.api_key || process.env.AZURE_OPENAI_API_KEY || '',
    apiVersion:
      settings.api_version ||
      process.env.AZURE_OPENAI_API_VERSION ||
      DEFAULT_AZURE_API_VERSION,
    whisperDeployment:
      settings.whisper_deployment ||
      process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ||
      'whisper',
    gptDeployment:
      settings.gpt_deployment ||
      process.env.AZURE_OPENAI_GPT_DEPLOYMENT ||
      'gpt-4',
    openaiWhisperModel:
      settings.openai_whisper_model ||
      process.env.OPENAI_WHISPER_MODEL ||
      'whisper-1',
    openaiGptModel:
      settings.openai_gpt_model || process.env.OPENAI_GPT_MODEL || 'gpt-4o'
  }
}

function applyOverrides(config, overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return config
  }

  return {
    ...config,
    provider:
      overrides.provider === 'openai'
        ? 'openai'
        : overrides.provider === 'azure'
          ? 'azure'
          : config.provider,
    azureEndpoint:
      overrides.azureEndpoint !== undefined
        ? cleanBaseUrl(overrides.azureEndpoint)
        : config.azureEndpoint,
    openaiBaseUrl:
      overrides.openaiBaseUrl !== undefined
        ? cleanBaseUrl(overrides.openaiBaseUrl, DEFAULT_OPENAI_BASE_URL)
        : config.openaiBaseUrl,
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : config.apiKey,
    apiVersion: overrides.apiVersion || config.apiVersion,
    whisperDeployment: overrides.whisperDeployment || config.whisperDeployment,
    gptDeployment: overrides.gptDeployment || config.gptDeployment,
    openaiWhisperModel:
      overrides.openaiWhisperModel || config.openaiWhisperModel,
    openaiGptModel: overrides.openaiGptModel || config.openaiGptModel
  }
}

function assertConfigForChat(config) {
  if (!config.apiKey) {
    throw new Error('AI provider API key is not configured')
  }
  if (config.provider === 'azure' && !config.azureEndpoint) {
    throw new Error('Azure OpenAI endpoint is not configured')
  }
}

function assertConfigForTranscription(config) {
  assertConfigForChat(config)
}

function getChatUrl(config) {
  if (config.provider === 'openai') {
    return `${config.openaiBaseUrl}/chat/completions`
  }
  return `${config.azureEndpoint}/openai/deployments/${config.gptDeployment}/chat/completions?api-version=${config.apiVersion}`
}

function getTranscriptionUrl(config) {
  if (config.provider === 'openai') {
    return `${config.openaiBaseUrl}/audio/transcriptions`
  }
  return `${config.azureEndpoint}/openai/deployments/${config.whisperDeployment}/audio/transcriptions?api-version=${config.apiVersion}`
}

function getAuthHeaders(config) {
  return config.provider === 'openai'
    ? { Authorization: `Bearer ${config.apiKey}` }
    : { 'api-key': config.apiKey }
}

export function getResolvedAiConfig(userId, overrides = null) {
  const base = getSettingsWithEnvFallback(userId)
  return applyOverrides(base, overrides || undefined)
}

export function getClientSafeAiSettings(userId) {
  const config = getResolvedAiConfig(userId)
  return {
    provider: config.provider,
    azureEndpoint: config.azureEndpoint,
    openaiBaseUrl: config.openaiBaseUrl,
    apiKey: '',
    keyConfigured: Boolean(config.apiKey),
    apiVersion: config.apiVersion,
    whisperDeployment: config.whisperDeployment,
    gptDeployment: config.gptDeployment,
    openaiWhisperModel: config.openaiWhisperModel,
    openaiGptModel: config.openaiGptModel
  }
}

export async function createChatCompletion(
  userId,
  payload = {},
  overrides = null
) {
  const config = getResolvedAiConfig(userId, overrides)
  assertConfigForChat(config)

  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length === 0) {
    throw new Error('messages array is required')
  }

  const body = {
    messages,
    temperature:
      typeof payload.temperature === 'number' ? payload.temperature : 0.3,
    max_tokens:
      typeof payload.max_tokens === 'number'
        ? payload.max_tokens
        : typeof payload.maxTokens === 'number'
          ? payload.maxTokens
          : 1200
  }

  if (payload.response_format) {
    body.response_format = payload.response_format
  }

  if (config.provider === 'openai') {
    body.model = payload.model || config.openaiGptModel
  }

  const response = await fetchWithTimeout(
    getChatUrl(config),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(config)
      },
      body: JSON.stringify(body)
    },
    DEFAULT_CHAT_TIMEOUT_MS
  )

  return parseJsonResponse(response, 'Chat completion failed')
}

export async function transcribeAudio(userId, payload = {}, overrides = null) {
  const config = getResolvedAiConfig(userId, overrides)
  assertConfigForTranscription(config)

  if (!payload.buffer || payload.buffer.length === 0) {
    throw new Error('Audio payload is empty')
  }

  const formData = new FormData()
  const fileName = payload.filename || 'audio.webm'
  const mimeType = payload.mimeType || 'application/octet-stream'

  formData.append(
    'file',
    new Blob([payload.buffer], { type: mimeType }),
    fileName
  )
  formData.append('language', payload.language || 'en')
  formData.append('response_format', payload.responseFormat || 'json')

  if (config.provider === 'openai') {
    formData.append('model', payload.model || config.openaiWhisperModel)
  }

  const response = await fetchWithTimeout(
    getTranscriptionUrl(config),
    {
      method: 'POST',
      headers: getAuthHeaders(config),
      body: formData
    },
    DEFAULT_TRANSCRIBE_TIMEOUT_MS
  )

  const result = await parseJsonResponse(response, 'Audio transcription failed')
  return result.text || ''
}

export async function testConnection(userId, overrides = null) {
  const config = getResolvedAiConfig(userId, overrides)
  assertConfigForChat(config)

  const testUrl =
    config.provider === 'openai'
      ? `${config.openaiBaseUrl}/models`
      : `${config.azureEndpoint}/openai/models?api-version=${config.apiVersion}`

  const response = await fetchWithTimeout(
    testUrl,
    {
      method: 'GET',
      headers: getAuthHeaders(config)
    },
    DEFAULT_CHAT_TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      parseErrorMessage(
        errorText,
        `Connection test failed: ${response.status} ${response.statusText}`
      )
    )
  }

  return { provider: config.provider, ok: true }
}
