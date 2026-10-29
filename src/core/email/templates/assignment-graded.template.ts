import { type EmailTemplateResult, escapeHtml, renderBaseEmailLayout } from './base.template';

export interface RenderAssignmentGradedOptions {
  recipientName: string;
  assignmentTitle: string;
  courseTitle: string;
  marks: number;
  maxMarks: number;
  gradeLabel: string;
  feedback?: string | null;
  portalUrl?: string;
}

export function renderAssignmentGradedEmail(
  options: RenderAssignmentGradedOptions,
): EmailTemplateResult {
  const {
    recipientName,
    assignmentTitle,
    courseTitle,
    marks,
    maxMarks,
    gradeLabel,
    feedback,
    portalUrl,
  } = options;

  const subject = `Assignment Graded: ${assignmentTitle} - Grade: ${gradeLabel}`;

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>Your submission for <strong>"${escapeHtml(assignmentTitle)}"</strong> in course <em>${escapeHtml(courseTitle)}</em> has been graded.</p>
      <div class="cred-box">
        <strong>Assignment:</strong> ${escapeHtml(assignmentTitle)}<br>
        <strong>Score:</strong> ${marks}/${maxMarks} (Grade: <strong>${escapeHtml(gradeLabel)}</strong>)<br>
        <strong>Feedback:</strong> ${feedback ? escapeHtml(feedback) : 'No additional comments.'}
      </div>
      ${
        portalUrl
          ? `<div class="btn-container"><a href="${escapeHtml(portalUrl)}" class="btn">View Grade & Feedback</a></div>`
          : ''
      }
    `,
  });

  const text = `Hello ${recipientName},\n\nYour submission for "${assignmentTitle}" in course "${courseTitle}" has been graded.\n\nScore: ${marks}/${maxMarks} (${gradeLabel})\nFeedback: ${feedback || 'No additional comments.'}${portalUrl ? `\n\nView details: ${portalUrl}` : ''}`;

  return { subject, text, html };
}
