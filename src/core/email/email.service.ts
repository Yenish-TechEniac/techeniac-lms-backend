import nodemailer, { Transporter } from 'nodemailer';

import { env } from '../config';
import { logger } from '../logging';
import {
  renderCourseAllocatedEmail,
  renderCourseDeadlineChangedEmail,
  renderInviteEmail,
  renderMenteeReassignedEmail,
  renderMentorMappedEmail,
  renderPasswordResetEmail,
} from './templates';

export interface SendPasswordResetOptions {
  to: string;
  name?: string;
  resetToken: string;
}

export interface SendCourseAllocatedOptions {
  to: string;
  recipientName: string;
  courseTitle: string;
  startDate: string;
  dueDate: string;
  batchName?: string;
}

export interface SendCourseDeadlineChangedOptions {
  to: string;
  recipientName: string;
  courseTitle: string;
  newDueDate: string;
}

export interface SendInviteEmailOptions {
  to: string;
  name: string;
  temporaryPassword: string;
  role: string;
}

export interface SendMentorMappedOptions {
  to: string;
  recipientName: string;
  isMentor: boolean;
  otherPartyName: string;
  batchName: string;
}

export interface SendMenteeReassignedOptions {
  to: string;
  recipientName: string;
  recipientRole: 'MENTEE' | 'NEW_MENTOR' | 'PREVIOUS_MENTOR';
  menteeName: string;
  mentorName: string;
  batchName: string;
  reason?: string;
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

  public async sendMentorMappedEmail(options: SendMentorMappedOptions): Promise<void> {
    const portalUrl = options.isMentor
      ? `${env.FRONTEND_URL}/mentor`
      : `${env.FRONTEND_URL}/mentee`;

    const { subject, text, html } = renderMentorMappedEmail({
      recipientName: options.recipientName,
      isMentor: options.isMentor,
      otherPartyName: options.otherPartyName,
      batchName: options.batchName,
      portalUrl,
    });

    if (!this.transporter) {
      logger.info(
        { isMentor: options.isMentor, batchName: options.batchName },
        'SMTP not configured in environment. Mentor mapping notification skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject,
        text,
        html,
      });

      logger.info(
        { batchName: options.batchName },
        'Mentor mapping email dispatched successfully via SMTP',
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch mentor mapping email',
      );
    }
  }

  public async sendMenteeReassignedEmail(options: SendMenteeReassignedOptions): Promise<void> {
    const portalUrl =
      options.recipientRole === 'MENTEE'
        ? `${env.FRONTEND_URL}/mentee`
        : `${env.FRONTEND_URL}/mentor`;

    const { subject, text, html } = renderMenteeReassignedEmail({
      recipientName: options.recipientName,
      recipientRole: options.recipientRole,
      menteeName: options.menteeName,
      mentorName: options.mentorName,
      batchName: options.batchName,
      reason: options.reason,
      portalUrl,
    });

    if (!this.transporter) {
      logger.info(
        { role: options.recipientRole, batchName: options.batchName },
        'SMTP not configured in environment. Mentee reassignment notification skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject,
        text,
        html,
      });

      logger.info(
        { role: options.recipientRole, batchName: options.batchName },
        'Mentee reassignment email dispatched successfully via SMTP',
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch mentee reassignment email',
      );
    }
  }

  public async sendCourseAllocatedEmail(options: SendCourseAllocatedOptions): Promise<void> {
    const portalUrl = `${env.FRONTEND_URL}/mentee/courses`;
    const { subject, text, html } = renderCourseAllocatedEmail({
      ...options,
      portalUrl,
    });

    if (!this.transporter) {
      logger.info(
        { to: options.to, courseTitle: options.courseTitle },
        'SMTP not configured in environment. Course allocation notification skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject,
        text,
        html,
      });

      logger.info(
        { to: options.to, courseTitle: options.courseTitle },
        'Course allocation email dispatched successfully via SMTP',
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch course allocation email',
      );
    }
  }

  public async sendCourseDeadlineChangedEmail(
    options: SendCourseDeadlineChangedOptions,
  ): Promise<void> {
    const portalUrl = `${env.FRONTEND_URL}/mentee/courses`;
    const { subject, text, html } = renderCourseDeadlineChangedEmail({
      ...options,
      portalUrl,
    });

    if (!this.transporter) {
      logger.info(
        { to: options.to, courseTitle: options.courseTitle },
        'SMTP not configured in environment. Course deadline change notification skipped in development.',
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject,
        text,
        html,
      });

      logger.info(
        { to: options.to, courseTitle: options.courseTitle },
        'Course deadline change email dispatched successfully via SMTP',
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch course deadline change email',
      );
    }
  }
}

export const emailService = new EmailService();
