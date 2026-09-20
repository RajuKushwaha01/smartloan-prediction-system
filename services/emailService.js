const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

/**
 * Generic sender — every email in the system funnels through here.
 * If SMTP isn't configured, logs to console instead of failing.
 * The core application NEVER depends on email succeeding.
 */
async function sendEmail(toEmail, subject, html) {
  if (!transporter) {
    console.log(`\n📧 [DEV MODE — no SMTP configured] Email to ${toEmail}`);
    console.log(`    Subject: ${subject}\n`);
    return { devMode: true };
  }

  try {
    await transporter.sendMail({ from: `"SmartLoan AI" <${process.env.SMTP_USER}>`, to: toEmail, subject, html });
    return { devMode: false, sent: true };
  } catch (e) {
    console.warn('⚠️ Email send failed (non-blocking):', e.message);
    return { devMode: false, sent: false, error: e.message };
  }
}

function wrapTemplate(title, bodyHtml) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;">
      <h2 style="color:#2563EB;">SmartLoan AI</h2>
      <h3 style="color:#0F172A;">${title}</h3>
      ${bodyHtml}
      <p style="color:#94A3B8;font-size:11px;margin-top:24px;">This is an automated message from SmartLoan AI, an academic decision-support system.</p>
    </div>
  `;
}

const sendRegistrationEmail = (toEmail, fullName) =>
  sendEmail(toEmail, 'Welcome to SmartLoan AI', wrapTemplate('Welcome!', `<p>Hi ${fullName}, your SmartLoan AI account has been created successfully.</p>`));

const sendApplicationSubmittedEmail = (toEmail, applicationId) =>
  sendEmail(toEmail, 'Application Submitted — SmartLoan AI', wrapTemplate('Application Submitted', `<p>Your application <strong>${applicationId}</strong> has been submitted and is being processed.</p>`));

const sendPredictionGeneratedEmail = (toEmail, applicationId, prediction) =>
  sendEmail(toEmail, 'AI Prediction Ready — SmartLoan AI', wrapTemplate('Prediction Generated', `<p>Your application <strong>${applicationId}</strong> has a new AI prediction: <strong>${prediction}</strong>. Log in to view the full explanation.</p>`));

const sendStatusUpdatedEmail = (toEmail, applicationId, status) =>
  sendEmail(toEmail, 'Application Status Updated — SmartLoan AI', wrapTemplate('Status Updated', `<p>Your application <strong>${applicationId}</strong> status has changed to <strong>${status}</strong>.</p>`));

const sendReportReadyEmail = (toEmail, applicationId, reportId) =>
  sendEmail(toEmail, 'Your Report is Ready — SmartLoan AI', wrapTemplate('Report Ready', `<p>Your report for application <strong>${applicationId}</strong> (Report ID: ${reportId}) is ready to download.</p>`));

const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (!transporter) {
    console.log('\n📧 [DEV MODE] Password Reset Link (no SMTP configured):');
    console.log(`    To: ${toEmail}`);
    console.log(`    Link: ${resetUrl}\n`);
    return { devMode: true, resetUrl };
  }
  await sendEmail(toEmail, 'Reset Your SmartLoan AI Password', wrapTemplate('Reset Password', `
    <p>You requested a password reset. Click below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Reset Password</a>
  `));
  return { devMode: false };
};

module.exports = {
  sendEmail,
  sendRegistrationEmail,
  sendApplicationSubmittedEmail,
  sendPredictionGeneratedEmail,
  sendStatusUpdatedEmail,
  sendReportReadyEmail,
  sendPasswordResetEmail
};