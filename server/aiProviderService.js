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

// Resolution precedence (env-first):
//   1. process.env.<VAR>  — if set to a non-empty trimmed string, wins
//   2. db settings row    — per-user value saved via the SettingsDialog
//   3. hard-coded default — last resort
//
// Previously this was db-first with env as a fallback; an operator could set
// OPENAI_API_KEY in .env but the platform would keep using whatever the admin
// had saved in the web UI. That's the wrong default for a self-hosted deploy
// where the .env is the source of truth. Reversing the precedence means the
// .env wins when set, and the web UI is still useful for users with no env
// override.
//
// We track which fields came from env in an `__envManaged` set on the
// resolved config so the SettingsDialog can mark them read-only ("Managed
// by environment") and avoid the confusing UX of saving a value that has
// no effect.

function isEnvSet(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function pickEnvFirst(envValue, dbValue, fallback = '') {
  if (isEnvSet(envValue)) {
    return { value: envValue, source: 'env' }
  }
  if (dbValue != null && String(dbValue).trim() !== '') {
    return { value: dbValue, source: 'db' }
  }
  return { value: fallback, source: 'default' }
}

// Decide which provider to use. Order:
//   1. AI_PROVIDER env var if explicitly "openai" or "azure"
//   2. DB settings.provider if set
//   3. If only OPENAI_API_KEY is set in env (no AZURE_OPENAI_API_KEY),
//      assume "openai" — keeps existing back-compat behavior
//   4. Default to "azure"
function pickProvider(settings) {
  if (process.env.AI_PROVIDER === 'openai') {
    return { value: 'openai', source: 'env' }
  }
  if (process.env.AI_PROVIDER === 'azure') {
    return { value: 'azure', source: 'env' }
  }
  if (settings.provider === 'openai') {
    return { value: 'openai', source: 'db' }
  }
  if (settings.provider === 'azure') {
    return { value: 'azure', source: 'db' }
  }
  if (
    isEnvSet(process.env.OPENAI_API_KEY) &&
    !isEnvSet(process.env.AZURE_OPENAI_API_KEY)
  ) {
    return { value: 'openai', source: 'env' }
  }
  return { value: 'azure', source: 'default' }
}

function getSettingsWithEnvFallback(userId) {
  const settings = db.getSettings(userId) || {}
  const providerPick = pickProvider(settings)
  const envManaged = new Set()

  // Helper to resolve a field and record env-managed source for the UI.
  const resolve = (key, envValue, dbValue, fallback = '', transform = v => v) => {
    const picked = pickEnvFirst(envValue, dbValue, fallback)
    if (picked.source === 'env') {
      envManaged.add(key)
    }
    return transform(picked.value)
  }

  if (providerPick.source === 'env') {
    envManaged.add('provider')
  }

  if (providerPick.value === 'openai') {
    const config = {
      provider: 'openai',
      azureEndpoint: '',
      openaiBaseUrl: resolve(
        'openaiBaseUrl',
        process.env.OPENAI_BASE_URL,
        settings.openai_base_url,
        DEFAULT_OPENAI_BASE_URL,
        v => cleanBaseUrl(v, DEFAULT_OPENAI_BASE_URL)
      ),
      apiKey: resolve(
        'apiKey',
        process.env.OPENAI_API_KEY,
        settings.api_key,
        ''
      ),
      apiVersion: resolve(
        'apiVersion',
        process.env.AZURE_OPENAI_API_VERSION,
        settings.api_version,
        DEFAULT_AZURE_API_VERSION
      ),
      whisperDeployment: resolve(
        'whisperDeployment',
        process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT,
        settings.whisper_deployment,
        'whisper'
      ),
      gptDeployment: resolve(
        'gptDeployment',
        process.env.AZURE_OPENAI_GPT_DEPLOYMENT,
        settings.gpt_deployment,
        'gpt-4'
      ),
      openaiWhisperModel: resolve(
        'openaiWhisperModel',
        process.env.OPENAI_WHISPER_MODEL,
        settings.openai_whisper_model,
        'whisper-1'
      ),
      openaiGptModel: resolve(
        'openaiGptModel',
        process.env.OPENAI_GPT_MODEL,
        settings.openai_gpt_model,
        'gpt-4o'
      )
    }
    Object.defineProperty(config, '__envManaged', {
      value: envManaged,
      enumerable: false,
      writable: false
    })
    return config
  }

  const config = {
    provider: 'azure',
    azureEndpoint: resolve(
      'azureEndpoint',
      process.env.AZURE_OPENAI_ENDPOINT,
      settings.azure_endpoint,
      '',
      v => cleanBaseUrl(v, '')
    ),
    openaiBaseUrl: resolve(
      'openaiBaseUrl',
      process.env.OPENAI_BASE_URL,
      settings.openai_base_url,
      DEFAULT_OPENAI_BASE_URL,
      v => cleanBaseUrl(v, DEFAULT_OPENAI_BASE_URL)
    ),
    apiKey: resolve(
      'apiKey',
      process.env.AZURE_OPENAI_API_KEY,
      settings.api_key,
      ''
    ),
    apiVersion: resolve(
      'apiVersion',
      process.env.AZURE_OPENAI_API_VERSION,
      settings.api_version,
      DEFAULT_AZURE_API_VERSION
    ),
    whisperDeployment: resolve(
      'whisperDeployment',
      process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT,
      settings.whisper_deployment,
      'whisper'
    ),
    gptDeployment: resolve(
      'gptDeployment',
      process.env.AZURE_OPENAI_GPT_DEPLOYMENT,
      settings.gpt_deployment,
      'gpt-4'
    ),
    openaiWhisperModel: resolve(
      'openaiWhisperModel',
      process.env.OPENAI_WHISPER_MODEL,
      settings.openai_whisper_model,
      'whisper-1'
    ),
    openaiGptModel: resolve(
      'openaiGptModel',
      process.env.OPENAI_GPT_MODEL,
      settings.openai_gpt_model,
      'gpt-4o'
    )
  }
  Object.defineProperty(config, '__envManaged', {
    value: envManaged,
    enumerable: false,
    writable: false
  })
  return config
}

function applyOverrides(config, overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return config
  }

  const result = {
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

  // Carry the env-managed tracking Set through. Object spread above only
  // copies enumerable properties; __envManaged is defined as non-enumerable
  // (so JSON.stringify ignores it) and would otherwise be dropped here,
  // leaving getClientSafeAiSettings with no way to report which fields are
  // env-managed.
  if (config.__envManaged instanceof Set) {
    Object.defineProperty(result, '__envManaged', {
      value: config.__envManaged,
      enumerable: false,
      writable: false
    })
  }

  return result
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
  // envManaged is a Set of resolved-config keys (apiKey, provider, ...) that
  // came from a process.env override. Serialize as a plain object map for the
  // UI to read. The SettingsDialog uses this to lock the corresponding inputs
  // and surface "Managed by environment" so the admin doesn't try to save a
  // value that has no effect.
  const envManaged = config.__envManaged instanceof Set ? config.__envManaged : new Set()
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
    openaiGptModel: config.openaiGptModel,
    envManaged: {
      provider: envManaged.has('provider'),
      apiKey: envManaged.has('apiKey'),
      azureEndpoint: envManaged.has('azureEndpoint'),
      openaiBaseUrl: envManaged.has('openaiBaseUrl'),
      apiVersion: envManaged.has('apiVersion'),
      whisperDeployment: envManaged.has('whisperDeployment'),
      gptDeployment: envManaged.has('gptDeployment'),
      openaiWhisperModel: envManaged.has('openaiWhisperModel'),
      openaiGptModel: envManaged.has('openaiGptModel')
    }
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
