import { type EmailTemplateResult, escapeHtml, renderBaseEmailLayout } from './base.template';

export interface RenderAllocationCompletedOptions {
  recipientName: string;
  menteeName: string;
  courseTitle: string;
  batchName?: string;
  portalUrl: string;
}

export function renderAllocationCompletedEmail(
  options: RenderAllocationCompletedOptions,
): EmailTemplateResult {
  const { recipientName, menteeName, courseTitle, batchName, portalUrl } = options;

  const subject = `Course Completed: ${menteeName} completed ${courseTitle}`;
  const batchInfo = batchName ? ` in batch <strong>${escapeHtml(batchName)}</strong>` : '';

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>Mentee <strong>${escapeHtml(menteeName)}</strong> has successfully completed 100% of the active topics for <strong>${escapeHtml(courseTitle)}</strong>${batchInfo}.</p>
      <p>You can review their progress, submissions, and assignment performance on the dashboard.</p>
      <div class="btn-container">
        <a href="${escapeHtml(portalUrl)}" class="btn">View Mentee Progress</a>
      </div>
    `,
  });

  const text = `Hello ${recipientName},\n\nMentee ${menteeName} has completed 100% of the course "${courseTitle}"${
    batchName ? ` in batch "${batchName}"` : ''
  }.\n\nReview progress at: ${portalUrl}`;

  return { subject, text, html };
}

export interface RenderTopicDeadlineChangedOptions {
  recipientName: string;
  topicTitle: string;
  courseTitle: string;
  deadline: string;
  portalUrl: string;
}

export function renderTopicDeadlineChangedEmail(
  options: RenderTopicDeadlineChangedOptions,
): EmailTemplateResult {
  const { recipientName, topicTitle, courseTitle, deadline, portalUrl } = options;

  const subject = `Topic Deadline Set: ${topicTitle} (${courseTitle})`;

  const html = renderBaseEmailLayout({
    title: subject,
    content: `
      <p class="heading">Hello ${escapeHtml(recipientName)},</p>
      <p>A deadline has been scheduled for topic <strong>${escapeHtml(topicTitle)}</strong> in course <strong>${escapeHtml(courseTitle)}</strong>:</p>
      <div class="cred-box">
        <strong>Topic:</strong> ${escapeHtml(topicTitle)}<br>
        <strong>Deadline:</strong> ${escapeHtml(deadline)}
      </div>
      <p>Please make sure to complete this topic and its assignments on time.</p>
      <div class="btn-container">
        <a href="${escapeHtml(portalUrl)}" class="btn">View Topic Progress</a>
      </div>
    `,
  });

  const text = `Hello ${recipientName},\n\nA deadline has been set for topic "${topicTitle}" in course "${courseTitle}":\nDeadline: ${deadline}\n\nView topic at: ${portalUrl}`;

  return { subject, text, html };
}
