import { type EmailTemplateResult, escapeHtml, renderBaseEmailLayout } from './base.template';

export interface RenderCourseAllocatedOptions {
  recipientName: string;
  courseTitle: string;
  startDate: string;
  dueDate: string;
  batchName?: string;
  portalUrl: string;
}

export function renderCourseAllocatedEmail(
  options: RenderCourseAllocatedOptions,
): EmailTemplateResult {
  const { recipientName, courseTitle, startDate, dueDate, batchName, portalUrl } = options;

  const subject = `Course Assigned: ${courseTitle}`;
  const batchInfo = batchName ? ` as part of batch <strong>${escapeHtml(batchName)}</strong>` : '';

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>A new course has been allocated to you${batchInfo}:</p>
      <div class="cred-box">
        <strong>Course:</strong> ${escapeHtml(courseTitle)}<br>
        <strong>Start Date:</strong> ${escapeHtml(startDate)}<br>
        <strong>Due Date:</strong> ${escapeHtml(dueDate)}
      </div>
      <p>Please log in to your dashboard to view your course outline and start learning.</p>
      <div class="btn-container">
        <a href="${escapeHtml(portalUrl)}" class="btn">View My Courses</a>
      </div>
    `,
  });

  const text = `Hello ${recipientName},\n\nA new course has been allocated to you:\nCourse: ${courseTitle}\nStart Date: ${startDate}\nDue Date: ${dueDate}${
    batchName ? `\nBatch: ${batchName}` : ''
  }\n\nAccess your courses at: ${portalUrl}`;

  return { subject, text, html };
}

export interface RenderCourseDeadlineChangedOptions {
  recipientName: string;
  courseTitle: string;
  newDueDate: string;
  portalUrl: string;
}

export function renderCourseDeadlineChangedEmail(
  options: RenderCourseDeadlineChangedOptions,
): EmailTemplateResult {
  const { recipientName, courseTitle, newDueDate, portalUrl } = options;

  const subject = `Course Deadline Updated: ${courseTitle}`;

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>The deadline for your allocated course has been updated:</p>
      <div class="cred-box">
        <strong>Course:</strong> ${escapeHtml(courseTitle)}<br>
        <strong>New Due Date:</strong> ${escapeHtml(newDueDate)}
      </div>
      <p>Please review your schedule to ensure your assignments are completed on time.</p>
      <div class="btn-container">
        <a href="${escapeHtml(portalUrl)}" class="btn">View Course</a>
      </div>
    `,
  });

  const text = `Hello ${recipientName},\n\nThe deadline for your course "${courseTitle}" has been updated.\nNew Due Date: ${newDueDate}\n\nAccess your course at: ${portalUrl}`;

  return { subject, text, html };
}
