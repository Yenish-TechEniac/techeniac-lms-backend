import { type EmailTemplateResult, escapeHtml, renderBaseEmailLayout } from './base.template';

export interface RenderResubmissionRequestedOptions {
  recipientName: string;
  assignmentTitle: string;
  courseTitle: string;
  feedback: string;
  portalUrl?: string;
}

export function renderResubmissionRequestedEmail(
  options: RenderResubmissionRequestedOptions,
): EmailTemplateResult {
  const { recipientName, assignmentTitle, courseTitle, feedback, portalUrl } = options;

  const subject = `Resubmission Requested: ${assignmentTitle}`;

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>A resubmission has been requested for your assignment <strong>"${escapeHtml(assignmentTitle)}"</strong> in course <em>${escapeHtml(courseTitle)}</em>.</p>
      <div class="cred-box">
        <strong>Mentor Feedback:</strong><br>
        <p style="margin: 8px 0 0 0; white-space: pre-wrap;">${escapeHtml(feedback)}</p>
      </div>
      <p>Please review the feedback and submit an updated version.</p>
      ${
        portalUrl
          ? `<div class="btn-container"><a href="${escapeHtml(portalUrl)}" class="btn">View Assignment</a></div>`
          : ''
      }
    `,
  });

  const text = `Hello ${recipientName},\n\nA resubmission has been requested for your assignment "${assignmentTitle}" in course "${courseTitle}".\n\nMentor Feedback:\n${feedback}\n\nPlease review the feedback and submit an updated version.${portalUrl ? `\n\nView assignment: ${portalUrl}` : ''}`;

  return { subject, text, html };
}
