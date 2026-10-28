import { type EmailTemplateResult, escapeHtml, renderBaseEmailLayout } from './base.template';

export interface RenderSubmissionReceivedOptions {
  recipientName: string;
  menteeName: string;
  assignmentTitle: string;
  courseTitle: string;
  version: number;
  submittedAtFormatted: string;
  portalUrl?: string;
}

export function renderSubmissionReceivedEmail(
  options: RenderSubmissionReceivedOptions,
): EmailTemplateResult {
  const {
    recipientName,
    menteeName,
    assignmentTitle,
    courseTitle,
    version,
    submittedAtFormatted,
    portalUrl,
  } = options;

  const subject = `New Submission: ${assignmentTitle} (v${version}) from ${menteeName}`;

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>Mentee <strong>${escapeHtml(menteeName)}</strong> has submitted assignment <strong>"${escapeHtml(assignmentTitle)}"</strong> for course <em>${escapeHtml(courseTitle)}</em> (Version ${version}).</p>
      <div class="cred-box">
        <strong>Assignment:</strong> ${escapeHtml(assignmentTitle)}<br>
        <strong>Version:</strong> ${version}<br>
        <strong>Submitted at:</strong> ${escapeHtml(submittedAtFormatted)}
      </div>
      ${
        portalUrl
          ? `<div class="btn-container"><a href="${escapeHtml(portalUrl)}" class="btn">View Submission</a></div>`
          : ''
      }
    `,
  });

  const text = `Hello ${recipientName},\n\nMentee ${menteeName} has submitted assignment "${assignmentTitle}" for course "${courseTitle}" (Version ${version}).\n\nSubmitted at: ${submittedAtFormatted}${
    portalUrl ? `\n\nView submission: ${portalUrl}` : ''
  }`;

  return { subject, text, html };
}
