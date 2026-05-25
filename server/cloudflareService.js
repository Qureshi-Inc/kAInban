// Cloudflare DNS automation service
import fetch from 'node-fetch'

class CloudflareService {
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID
    this.baseUrl = 'https://api.cloudflare.com/client/v4'
  }

  async createSubdomain(subdomain, targetIp) {
    if (!this.apiToken || !this.zoneId) {
      console.log('[Cloudflare] API not configured - skipping DNS creation')
      return false
    }

    try {
      const response = await fetch(`${this.baseUrl}/zones/${this.zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'A',
          name: subdomain,
          content: targetIp,
          proxied: true,
          ttl: 1 // Auto TTL when proxied
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('[Cloudflare] Created DNS record for:', subdomain)
        return true
      } else {
        console.error('[Cloudflare] DNS creation failed:', result.errors)
        return false
      }
    } catch (error) {
      console.error('[Cloudflare] DNS API error:', error)
      return false
    }
  }

  async deleteSubdomain(subdomain) {
    if (!this.apiToken || !this.zoneId) {return false}

    try {
      // Get base domain from APP_URL environment variable
      const appUrl = process.env.APP_URL || 'https://notes.rodeomasjid.org'
      const baseDomain = new URL(appUrl).hostname

      // First find the record ID
      const listResponse = await fetch(
        `${this.baseUrl}/zones/${this.zoneId}/dns_records?name=${subdomain}.${baseDomain}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const listResult = await listResponse.json()

      if (listResult.success && listResult.result.length > 0) {
        const recordId = listResult.result[0].id

        // Delete the record
        const deleteResponse = await fetch(
          `${this.baseUrl}/zones/${this.zoneId}/dns_records/${recordId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        const deleteResult = await deleteResponse.json()
        return deleteResult.success
      }
    } catch (error) {
      console.error('[Cloudflare] DNS deletion error:', error)
      return false
    }
  }

  // Create wildcard SSL certificate for tenant subdomains
  async createWildcardSSL(domain) {
    if (!this.apiToken || !this.zoneId) {
      console.log('[Cloudflare] API not configured - skipping SSL creation')
      return false
    }

    try {
      // Check if wildcard certificate already exists
      const existingResponse = await fetch(`${this.baseUrl}/zones/${this.zoneId}/ssl/certificate_packs`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      const existingResult = await existingResponse.json()

      if (existingResult.success) {
        // Check if we already have a wildcard certificate for this domain
        const wildcardPattern = `*.${domain}`
        const hasWildcard = existingResult.result.some(cert =>
          cert.hosts && cert.hosts.includes(wildcardPattern)
        )

        if (hasWildcard) {
          console.log('[Cloudflare] Wildcard SSL certificate already exists for:', wildcardPattern)
          return true
        }
      }

      // Create new wildcard SSL certificate
      const response = await fetch(`${this.baseUrl}/zones/${this.zoneId}/ssl/certificate_packs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'advanced',
          hosts: [`*.${domain}`, domain],
          validation_method: 'txt',
          validity_days: 90,
          certificate_authority: 'lets_encrypt'
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('[Cloudflare] Created wildcard SSL certificate for:', domain)
        return true
      } else {
        console.error('[Cloudflare] SSL creation failed:', result.errors)
        return false
      }
    } catch (error) {
      console.error('[Cloudflare] SSL API error:', error)
      return false
    }
  }

  // Setup complete tenant infrastructure (DNS + SSL)
  async setupTenantInfrastructure(subdomain) {
    if (!this.apiToken || !this.zoneId) {
      console.log('[Cloudflare] API not configured - manual setup required')
      return { dns: false, ssl: false }
    }

    const appUrl = process.env.APP_URL || 'https://notes.rodeomasjid.org'
    const baseDomain = new URL(appUrl).hostname
    const targetIp = process.env.CLOUDFLARE_TARGET_IP

    console.log('[Cloudflare] Setting up tenant infrastructure:', { subdomain, baseDomain })

    const results = { dns: false, ssl: false }

    // 1. Create DNS record for specific subdomain
    if (targetIp) {
      results.dns = await this.createSubdomain(`${subdomain}.${baseDomain}`, targetIp)
    }

    // 2. Ensure wildcard SSL certificate exists for the base domain
    results.ssl = await this.createWildcardSSL(baseDomain)

    console.log('[Cloudflare] Tenant infrastructure setup complete:', results)
    return results
  }
}

export default new CloudflareService()