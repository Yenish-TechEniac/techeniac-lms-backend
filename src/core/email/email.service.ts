import nodemailer, { Transporter } from 'nodemailer';

import { enqueueEmailJob } from '../../jobs/email.queue';
import type { EmailJobData } from '../../jobs/email.types';
import { env } from '../config';
import { logger } from '../logging';
import {
  MenteeReassignRecipientRole,
  renderAllocationCompletedEmail,
  renderAssignmentGradedEmail,
  renderCourseAllocatedEmail,
  renderCourseDeadlineChangedEmail,
  renderInviteEmail,
  renderMenteeReassignedEmail,
  renderMentorMappedEmail,
  renderPasswordResetEmail,
  renderResubmissionRequestedEmail,
  renderSubmissionReceivedEmail,
  renderTopicDeadlineChangedEmail,
} from './templates';

export interface SendPasswordResetOptions {
  to: string;
  name?: string;
  resetToken: string;
}

export interface SendCourseAllocatedOptions {
  to: string;
  userId?: string;
  recipientName: string;
  courseTitle: string;
  startDate: string;
  dueDate: string;
  batchName?: string;
}

export interface SendCourseDeadlineChangedOptions {
  to: string;
  userId?: string;
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
  recipientRole: MenteeReassignRecipientRole;
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

export interface SendAssignmentGradedOptions {
  to: string;
  recipientName: string;
  assignmentTitle: string;
  courseTitle: string;
  marks: number;
  maxMarks: number;
  gradeLabel: string;
  feedback?: string | null;
}

export interface SendResubmissionRequestedOptions {
  to: string;
  recipientName: string;
  assignmentTitle: string;
  courseTitle: string;
  feedback: string;
}

export interface SendAllocationCompletedOptions {
  to: string;
  recipientName: string;
  menteeName: string;
  courseTitle: string;
  batchName?: string;
}

export interface SendTopicDeadlineChangedOptions {
  to: string;
  recipientName: string;
  topicTitle: string;
  courseTitle: string;
  deadline: string;
}

export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    if (env.SMTP_HOST) {
      // Port 465 requires direct SSL (secure: true); port 587 uses STARTTLS (secure: false)
      const secure = env.SMTP_PORT === 465 ? true : env.SMTP_SECURE && env.SMTP_PORT !== 587;
      this.transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
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

  private async enqueueOrDispatch(job: EmailJobData): Promise<void> {
    const enqueued = await enqueueEmailJob(job);
    if (enqueued) {
      return;
    }

    logger.warn(
      { jobType: job.type },
      'BullMQ email queue unavailable; falling back to direct SMTP dispatch',
    );
    try {
      await this.dispatchDirectly(job);
    } catch (error) {
      logger.error({ err: error, jobType: job.type }, 'Direct SMTP fallback email dispatch failed');
      if (job.type === 'INVITE') {
        throw error;
      }
    }
  }

  private async sendMailInternal(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    description: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.transporter) {
      logger.info(
        options.meta ?? {},
        `SMTP not configured in environment. ${options.description} notification skipped in development.`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info(
        options.meta ?? {},
        `${options.description} email dispatched successfully via SMTP`,
      );
    } catch (error) {
      logger.error(
        { err: error, event: 'EMAIL_DISPATCH_FAILURE', service: 'smtp', ...options.meta },
        `Failed to dispatch ${options.description.toLowerCase()} email`,
      );
      throw error;
    }
  }

  public async dispatchDirectly(job: EmailJobData): Promise<void> {
    switch (job.type) {
      case 'PASSWORD_RESET': {
        const { to, name, resetToken } = job.payload;
        const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
        const { subject, text, html } = renderPasswordResetEmail({ name, resetUrl });
        await this.sendMailInternal({ to, subject, text, html, description: 'Password reset' });
        break;
      }
      case 'INVITE': {
        const { to, name, temporaryPassword, role } = job.payload;
        const loginUrl = `${env.FRONTEND_URL}/login`;
        const { subject, text, html } = renderInviteEmail({
          name,
          email: to,
          temporaryPassword,
          role,
          loginUrl,
        });
        await this.sendMailInternal({ to, subject, text, html, description: 'User invitation' });
        break;
      }
      case 'MENTOR_MAPPED': {
        const { to, recipientName, isMentor, otherPartyName, batchName } = job.payload;
        const portalUrl = isMentor ? `${env.FRONTEND_URL}/mentor` : `${env.FRONTEND_URL}/mentee`;
        const { subject, text, html } = renderMentorMappedEmail({
          recipientName,
          isMentor,
          otherPartyName,
          batchName,
          portalUrl,
        });
        await this.sendMailInternal({
          to,
          subject,
          text,
          html,
          description: 'Mentor mapping',
          meta: { batchName },
        });
        break;
      }
      case 'MENTEE_REASSIGNED': {
        const { to, recipientName, recipientRole, menteeName, mentorName, batchName, reason } =
          job.payload;
        const portalUrl =
          recipientRole === MenteeReassignRecipientRole.MENTEE
            ? `${env.FRONTEND_URL}/mentee`
            : `${env.FRONTEND_URL}/mentor`;
        const { subject, text, html } = renderMenteeReassignedEmail({
          recipientName,
          recipientRole,
          menteeName,
          mentorName,
          batchName,
          reason,
          portalUrl,
        });
        await this.sendMailInternal({
          to,
          subject,
          text,
          html,
          description: 'Mentee reassignment',
          meta: { role: recipientRole, batchName },
        });
        break;
      }
      case 'SUBMISSION_RECEIVED': {
        const {
          to,
          recipientName,
          menteeName,
          assignmentTitle,
          courseTitle,
          version,
          submittedAt,
        } = job.payload;
        const submittedDate = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
        const istTimeStr =
          submittedDate.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'medium',
          }) + ' IST';
        const { subject, text, html } = renderSubmissionReceivedEmail({
          recipientName,
          menteeName,
          assignmentTitle,
          courseTitle,
          version,
          submittedAtFormatted: istTimeStr,
          portalUrl: `${env.FRONTEND_URL}/submissions`,
        });
        await this.sendMailInternal({
          to,
          subject,
          text,
          html,
          description: 'Submission received',
          meta: { menteeName, assignmentTitle },
        });
        break;
      }
      case 'ASSIGNMENT_GRADED': {
        const portalUrl = `${env.FRONTEND_URL}/mentee/assignments`;
        const { subject, text, html } = renderAssignmentGradedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Assignment graded',
          meta: { assignmentTitle: job.payload.assignmentTitle },
        });
        break;
      }
      case 'RESUBMISSION_REQUESTED': {
        const portalUrl = `${env.FRONTEND_URL}/mentee/assignments`;
        const { subject, text, html } = renderResubmissionRequestedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Resubmission requested',
          meta: { assignmentTitle: job.payload.assignmentTitle },
        });
        break;
      }
      case 'COURSE_ALLOCATED': {
        const portalUrl = `${env.FRONTEND_URL}/mentee/courses`;
        const { subject, text, html } = renderCourseAllocatedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Course allocation',
          meta: { userId: job.payload.userId, courseTitle: job.payload.courseTitle },
        });
        break;
      }
      case 'COURSE_DEADLINE_CHANGED': {
        const portalUrl = `${env.FRONTEND_URL}/mentee/courses`;
        const { subject, text, html } = renderCourseDeadlineChangedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Course deadline change',
          meta: { userId: job.payload.userId, courseTitle: job.payload.courseTitle },
        });
        break;
      }
      case 'ALLOCATION_COMPLETED': {
        const portalUrl = `${env.FRONTEND_URL}/mentor/mentees`;
        const { subject, text, html } = renderAllocationCompletedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Course completion',
          meta: { courseTitle: job.payload.courseTitle },
        });
        break;
      }
      case 'TOPIC_DEADLINE_CHANGED': {
        const portalUrl = `${env.FRONTEND_URL}/mentee/courses`;
        const { subject, text, html } = renderTopicDeadlineChangedEmail({
          ...job.payload,
          portalUrl,
        });
        await this.sendMailInternal({
          to: job.payload.to,
          subject,
          text,
          html,
          description: 'Topic deadline change',
          meta: { courseTitle: job.payload.courseTitle, topicTitle: job.payload.topicTitle },
        });
        break;
      }
    }
  }

  public async sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'PASSWORD_RESET', payload: options });
  }

  public async sendInviteEmail(options: SendInviteEmailOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'INVITE', payload: options });
  }

  public async sendMentorMappedEmail(options: SendMentorMappedOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'MENTOR_MAPPED', payload: options });
  }

  public async sendMenteeReassignedEmail(options: SendMenteeReassignedOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'MENTEE_REASSIGNED', payload: options });
  }

  public async sendSubmissionReceivedEmail(options: SendSubmissionReceivedOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'SUBMISSION_RECEIVED', payload: options });
  }

  public async sendAssignmentGradedEmail(options: SendAssignmentGradedOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'ASSIGNMENT_GRADED', payload: options });
  }

  public async sendResubmissionRequestedEmail(
    options: SendResubmissionRequestedOptions,
  ): Promise<void> {
    await this.enqueueOrDispatch({ type: 'RESUBMISSION_REQUESTED', payload: options });
  }

  public async sendCourseAllocatedEmail(options: SendCourseAllocatedOptions): Promise<void> {
    await this.enqueueOrDispatch({ type: 'COURSE_ALLOCATED', payload: options });
  }

  public async sendCourseDeadlineChangedEmail(
    options: SendCourseDeadlineChangedOptions,
  ): Promise<void> {
    await this.enqueueOrDispatch({ type: 'COURSE_DEADLINE_CHANGED', payload: options });
  }

  public async sendAllocationCompletedEmail(
    options: SendAllocationCompletedOptions,
  ): Promise<void> {
    await this.enqueueOrDispatch({ type: 'ALLOCATION_COMPLETED', payload: options });
  }

  public async sendTopicDeadlineChangedEmail(
    options: SendTopicDeadlineChangedOptions,
  ): Promise<void> {
    await this.enqueueOrDispatch({ type: 'TOPIC_DEADLINE_CHANGED', payload: options });
  }
}

export const emailService = new EmailService();
