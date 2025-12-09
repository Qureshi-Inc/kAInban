// PocketID Integration for Automated Account Creation
import crypto from 'crypto'
import nodemailer from 'nodemailer'

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

  // Method 1: Direct API account creation with admin token
  async createPocketIDAccount(email, name) {
    const adminToken = process.env.POCKETID_ADMIN_TOKEN;
    if (!adminToken) {
      console.log('[PocketID] Skipping direct account creation - no admin token configured');
      return { success: false, error: 'No admin token configured' };
    }

    try {
      // TODO: Replace with actual PocketID admin API endpoint
      const response = await fetch(`${process.env.POCKET_ID_ISSUER}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          name,
          send_invitation: true,
          return_url: process.env.APP_URL
        })
      });

      if (response.ok) {
        const user = await response.json();
        console.log(`[PocketID] Account created for ${email}`);
        return { success: true, user };
      } else {
        console.log('[PocketID] Admin API account creation failed:', response.statusText);
        return { success: false, error: 'Admin API failed' };
      }
    } catch (error) {
      console.log('[PocketID] Admin API error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Method 2: Generate invitation email (most PocketID instances don't support this API)
  async sendInvitation(_email, _name, _returnUrl) {
    // Skip this method for now since most PocketID instances don't have invitation APIs
    console.log('[PocketID] Skipping invitation API - not supported by most PocketID instances');
    return { success: false, error: 'Invitation API not supported' };
  }

  // Method 3: Generate magic registration link
  generateRegistrationLink(email, name, _intentId) {
    // For most PocketID instances, the signup is handled through OIDC flow
    // We'll create a simple registration URL that redirects back to kAInban
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.error('[PocketID] Missing APP_URL environment variable for registration link');
      throw new Error('Server configuration error: Missing APP_URL');
    }

    const params = new URLSearchParams({
      email,
      name,
      return_to: appUrl,
      source: 'kainban'
    });

    // Most PocketID instances use '/auth' or '/signup' or just redirect to login
    return `${this.pocketIdUrl}?${params.toString()}`;
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

  // Email service integration
  async sendEmail(emailData) {
    try {
      // Create nodemailer transporter based on environment variables
      let transporter;

      if (process.env.SENDGRID_API_KEY) {
        // SendGrid SMTP
        transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else if (process.env.SMTP_HOST) {
        // Generic SMTP
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Fallback: Gmail SMTP (for testing)
        console.log('[Email] No SMTP configured, using Gmail fallback (configure SMTP_* env vars for production)');
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD // App password, not regular password
          }
        });
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@kainban.com',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      };

      console.log(`[Email] Sending email to ${emailData.to}...`);
      const result = await transporter.sendMail(mailOptions);
      console.log(`[Email] Email sent successfully: ${result.messageId}`);

      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('[Email] Failed to send email:', error.message);

      // If email fails, we still want to show instructions to the user
      console.log('[Email] Email delivery failed, but signup process will continue with manual instructions');
      return { success: false, error: error.message };
    }
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