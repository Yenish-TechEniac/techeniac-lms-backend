import nodemailer, { Transporter } from 'nodemailer';

import { env } from '../config';
import { logger } from '../logging';
import {
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

export interface SendSubmissionReceivedOptions {
  to: string;
  recipientName: string;
  menteeName: string;
  assignmentTitle: string;
  courseTitle: string;
  version: number;
  submittedAt: Date;
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

  async sendSubmissionReceivedEmail(options: SendSubmissionReceivedOptions): Promise<void> {
    const istTimeStr =
      options.submittedAt.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }) + ' IST';
    const subject = `New Submission: ${options.assignmentTitle} (v${options.version}) from ${options.menteeName}`;
    const text = `Hello ${options.recipientName},\n\nMentee ${options.menteeName} has submitted assignment "${options.assignmentTitle}" for course "${options.courseTitle}" (Version ${options.version}).\n\nSubmitted at: ${istTimeStr}`;
    const html = `<p>Hello <strong>${options.recipientName}</strong>,</p><p>Mentee <strong>${options.menteeName}</strong> has submitted assignment <strong>"${options.assignmentTitle}"</strong> for course <em>${options.courseTitle}</em> (Version ${options.version}).</p><p>Submitted at: <strong>${istTimeStr}</strong></p>`;

    if (!this.transporter) {
      logger.info(
        { menteeName: options.menteeName, assignmentTitle: options.assignmentTitle },
        'SMTP not configured in environment. Submission received email skipped in development.',
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
        { menteeName: options.menteeName, assignmentTitle: options.assignmentTitle },
        'Submission received email dispatched successfully via SMTP',
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp' },
        'Failed to dispatch submission received email',
      );
    }
  }
}

export const emailService = new EmailService();
