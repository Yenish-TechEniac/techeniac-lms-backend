import nodemailer, { Transporter } from 'nodemailer';

import { env } from '../config';
import { logger } from '../logging';
import { renderInviteEmail, renderPasswordResetEmail } from './templates';

export interface SendPasswordResetOptions {
  to: string;
  name?: string;
  resetToken: string;
}

export interface SendInviteEmailOptions {
  to: string;
  name: string;
  temporaryPassword: string;
  role: string;
}

export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    if (env.SMTP_HOST) {
      // Port 465 requires direct SSL (secure: true); port 587 uses STARTTLS (secure: false)
      const secure = env.SMTP_PORT === 465 ? true : env.SMTP_SECURE && env.SMTP_PORT !== 587;
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure,
        requireTLS: true,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              }
            : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  public async sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<void> {
    const { to, name, resetToken } = options;
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const { subject, text, html } = renderPasswordResetEmail({ name, resetUrl });

    if (!this.transporter) {
      logger.info(
        'SMTP not configured in environment. Password reset email skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      logger.info('Password reset email dispatched successfully via SMTP');
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch password reset email',
      );
      // Do not rethrow in a way that leaks email delivery details to caller
    }
  }

  public async sendInviteEmail(options: SendInviteEmailOptions): Promise<void> {
    const { to, name, temporaryPassword, role } = options;
    const loginUrl = `${env.FRONTEND_URL}/login`;
    const { subject, text, html } = renderInviteEmail({
      name,
      email: to,
      temporaryPassword,
      role,
      loginUrl,
    });

    if (!this.transporter) {
      logger.info(
        'SMTP not configured in environment. User invitation email skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      logger.info('User invitation email dispatched successfully via SMTP');
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch user invitation email',
      );
      throw error;
    }
  }
}

export const emailService = new EmailService();
