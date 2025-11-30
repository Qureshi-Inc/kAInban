// PocketID Integration for Automated Account Creation
import fetch from 'node-fetch'
import crypto from 'crypto'

class PocketIDIntegration {
  constructor(config) {
    this.pocketIdUrl = config.pocketIdUrl || 'https://login.qureshi.io';
    this.adminToken = config.adminToken; // Admin API token if available
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.signupIntents = new Map(); // In-memory storage for signup intents
  }

  // Create a signup intent (track users through the signup process)
  createSignupIntent(email, name, source = 'landing_page') {
    const intentId = crypto.randomUUID();
    const intent = {
      id: intentId,
      email,
      name,
      source,
      createdAt: new Date(),
      status: 'created',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.signupIntents.set(intentId, intent);

    // Clean up expired intents
    this.cleanupExpiredIntents();

    return intent;
  }

  // Get signup intent by ID
  getSignupIntent(intentId) {
    const intent = this.signupIntents.get(intentId);
    if (intent && intent.expiresAt > new Date()) {
      return intent;
    }
    return null;
  }

  // Update signup intent status
  updateSignupIntent(intentId, updates) {
    const intent = this.signupIntents.get(intentId);
    if (intent) {
      Object.assign(intent, updates, { updatedAt: new Date() });
      this.signupIntents.set(intentId, intent);
      return intent;
    }
    return null;
  }

  // Clean up expired signup intents
  cleanupExpiredIntents() {
    const now = new Date();
    for (const [id, intent] of this.signupIntents.entries()) {
      if (intent.expiresAt <= now) {
        this.signupIntents.delete(id);
      }
    }
  }

  // Method 1: Direct API account creation (if PocketID supports it)
  async createPocketIDAccount(email, name) {
    try {
      // This would be the ideal approach if PocketID has admin APIs
      const response = await fetch(`${this.pocketIdUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken}`,
        },
        body: JSON.stringify({
          email,
          name,
          sendWelcomeEmail: true,
          clientReturnUrl: `${process.env.KAINBAN_URL}/welcome`
        })
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, user: result };
      } else {
        throw new Error(`PocketID API error: ${response.status}`);
      }
    } catch (error) {
      console.warn('[PocketID] Direct account creation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Method 2: Generate invitation email (if PocketID supports invitations)
  async sendInvitation(email, name, returnUrl) {
    try {
      const response = await fetch(`${this.pocketIdUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken}`,
        },
        body: JSON.stringify({
          email,
          name,
          inviteMessage: `Welcome to kAInban! Complete your account setup to start managing tasks with AI.`,
          returnUrl: returnUrl || `${process.env.KAINBAN_URL}/dashboard`,
          expiresIn: '7d'
        })
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, invitation: result };
      } else {
        throw new Error(`Invitation failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('[PocketID] Invitation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Method 3: Generate magic registration link
  generateRegistrationLink(email, name, intentId) {
    const params = new URLSearchParams({
      email,
      name,
      client_id: this.clientId,
      return_to: `${process.env.KAINBAN_URL}/auth/pocketid/callback`,
      signup_intent: intentId,
      signup_source: 'kainban_landing'
    });

    return `${this.pocketIdUrl}/register?${params.toString()}`;
  }

  // Method 4: Send custom email with registration link
  async sendRegistrationEmail(email, name, intentId) {
    const registrationLink = this.generateRegistrationLink(email, name, intentId);

    // This would integrate with your email service (SendGrid, Mailgun, etc.)
    const emailContent = this.generateWelcomeEmail(name, email, registrationLink);

    try {
      // Replace with your actual email service
      await this.sendEmail({
        to: email,
        subject: 'Complete Your kAInban Setup',
        html: emailContent
      });

      return { success: true, registrationLink };
    } catch (error) {
      console.error('[Email] Failed to send registration email:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate welcome email HTML
  generateWelcomeEmail(name, email, registrationLink) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to kAInban</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">Welcome to kAInban!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">AI-Powered Task Management</p>
  </div>

  <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
    <h2 style="color: #667eea; margin: 0 0 15px 0;">Hi ${name || 'there'}!</h2>

    <p>Thanks for signing up for kAInban! You're just one step away from revolutionizing how you manage tasks with AI.</p>

    <p><strong>What's next?</strong></p>
    <ol style="padding-left: 20px;">
      <li>Click the button below to complete your account setup</li>
      <li>Create your secure PocketID account (with passkey for extra security)</li>
      <li>Start recording meetings and let AI extract your tasks!</li>
    </ol>
  </div>

  <div style="text-align: center; margin: 40px 0;">
    <a href="${registrationLink}"
       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 18px;
              display: inline-block;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
      Complete Your Setup →
    </a>
  </div>

  <div style="background: #e0e7ff; padding: 20px; border-radius: 8px; margin: 30px 0;">
    <h3 style="color: #4338ca; margin: 0 0 10px 0; font-size: 16px;">🔐 Why PocketID?</h3>
    <p style="margin: 0; color: #6366f1; font-size: 14px;">
      PocketID provides secure, passwordless authentication using passkeys (Face ID, Touch ID, Windows Hello).
      No more forgotten passwords - just secure, seamless access to your kAInban account.
    </p>
  </div>

  <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
    <p>Need help? Reply to this email or visit our <a href="https://qureshi-inc.github.io/kAInban/#faq" style="color: #667eea;">FAQ</a></p>
    <p>This registration link expires in 24 hours for security.</p>
    <p style="margin-top: 20px;">
      <strong>kAInban Team</strong><br>
      Making task management intelligent
    </p>
  </div>

</body>
</html>
    `;
  }

  // Placeholder for email service integration
  async sendEmail(emailData) {
    // This should integrate with your actual email service
    // Examples: SendGrid, Mailgun, AWS SES, etc.
    console.log('[Email] Would send email:', {
      to: emailData.to,
      subject: emailData.subject,
      // Don't log HTML content in production
    });

    // For now, just log that email would be sent
    // In production, implement with your email service:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: emailData.to,
      from: 'noreply@kainban.com',
      subject: emailData.subject,
      html: emailData.html,
    };

    await sgMail.send(msg);
    */

    return { success: true };
  }

  // Attempt all signup methods in order of preference
  async processSignup(email, name, returnUrl) {
    console.log(`[PocketID] Processing signup for ${email}`);

    // Create signup intent first
    const intent = this.createSignupIntent(email, name);

    try {
      // Method 1: Try direct API account creation
      console.log('[PocketID] Attempting direct account creation...');
      const directResult = await this.createPocketIDAccount(email, name);

      if (directResult.success) {
        this.updateSignupIntent(intent.id, {
          status: 'completed',
          method: 'direct_api',
          userId: directResult.user.id
        });
        return {
          success: true,
          method: 'direct_api',
          message: 'Account created successfully! You can now sign in.'
        };
      }

    } catch (error) {
      console.warn('[PocketID] Direct creation failed:', error.message);
    }

    try {
      // Method 2: Try invitation API
      console.log('[PocketID] Attempting invitation...');
      const inviteResult = await this.sendInvitation(email, name, returnUrl);

      if (inviteResult.success) {
        this.updateSignupIntent(intent.id, {
          status: 'invitation_sent',
          method: 'invitation_api'
        });
        return {
          success: true,
          method: 'invitation',
          message: 'Invitation sent! Check your email for setup instructions.'
        };
      }

    } catch (error) {
      console.warn('[PocketID] Invitation failed:', error.message);
    }

    try {
      // Method 3: Send custom registration email
      console.log('[PocketID] Sending custom registration email...');
      const emailResult = await this.sendRegistrationEmail(email, name, intent.id);

      if (emailResult.success) {
        this.updateSignupIntent(intent.id, {
          status: 'registration_email_sent',
          method: 'custom_email',
          registrationLink: emailResult.registrationLink
        });
        return {
          success: true,
          method: 'email',
          message: 'Setup instructions sent! Check your email to complete registration.',
          registrationLink: emailResult.registrationLink
        };
      }

    } catch (error) {
      console.warn('[PocketID] Custom email failed:', error.message);
    }

    // Method 4: Return manual instructions
    console.log('[PocketID] Falling back to manual instructions');
    const registrationLink = this.generateRegistrationLink(email, name, intent.id);

    this.updateSignupIntent(intent.id, {
      status: 'manual_instructions',
      method: 'manual',
      registrationLink
    });

    return {
      success: true,
      method: 'manual',
      message: 'Please complete your registration manually.',
      registrationLink,
      instructions: {
        steps: [
          `Visit ${this.pocketIdUrl}`,
          `Create account with email: ${email}`,
          'Enable passkey in Security settings',
          'Return to kAInban and sign in'
        ]
      }
    };
  }
}

export default PocketIDIntegration;