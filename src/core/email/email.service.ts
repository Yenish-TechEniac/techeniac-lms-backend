import nodemailer, { Transporter } from 'nodemailer';

import { env } from '../config';
import { logger } from '../logging';

export interface SendPasswordResetOptions {
  to: string;
  name?: string;
  resetToken: string;
}

export class EmailService {
  private readonly transporter: Transporter;
  private readonly isConfigured: boolean;

  constructor() {
    if (env.SMTP_HOST) {
      this.isConfigured = true;
      // Port 465 requires direct SSL (secure: true); port 587 uses STARTTLS (secure: false)
      const secure = env.SMTP_PORT === 465 ? true : env.SMTP_SECURE && env.SMTP_PORT !== 587;
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure,
        requireTLS: !secure,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              }
            : undefined,
      });
    } else {
      this.isConfigured = false;
      // In local dev without SMTP server configured, use a stream transport to prevent crashes
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
        secure: true,
      } as Parameters<typeof nodemailer.createTransport>[0]) as Transporter;
    }
  }

  public async sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<void> {
    const { to, name, resetToken } = options;
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const recipientName = name ?? 'User';

    const subject = 'Reset Your Techeniac LMS Password';
    const text = `Hello ${recipientName},

You requested to reset your password for Techeniac LMS. Please click the link below or copy and paste it into your browser to choose a new password:

${resetUrl}

This link is valid for 30 minutes and can only be used once. If you did not request this, please ignore this email and your password will remain unchanged.

Best regards,
The Techeniac Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }
    .logo { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #3b82f6; color: #ffffff !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5; }
    .url { word-break: break-all; color: #3b82f6; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Techeniac LMS</div>
    <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Password Reset Request</h2>
    <p>Hello ${recipientName},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <div>
      <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #475569;">Or copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}" class="url">${resetUrl}</a></p>
    <p style="font-size: 13px; color: #64748b;">This link will expire in 30 minutes. If you did not request a password reset, you can safely ignore this email.</p>
    <div class="footer">
      Techeniac LMS • Learning Management System<br>
      This is an automated notification, please do not reply directly.
    </div>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      if (!this.isConfigured) {
        logger.info(
          'SMTP not configured in environment. Password reset email skipped in development.',
        );
      } else {
        logger.info('Password reset email dispatched successfully via SMTP');
      }
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch password reset email',
      );
      // Do not rethrow in a way that leaks email delivery details to caller
    }
  }
}

export const emailService = new EmailService();
