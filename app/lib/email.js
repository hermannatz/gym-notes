import nodemailer from 'nodemailer';

/**
 * Build the Nodemailer transport.
 *
 * Prefers Resend SMTP (over port 465) when RESEND_API_KEY is present,
 * otherwise falls back to a plain SMTP server defined by SMTP_HOST / SMTP_PORT,
 * defaulting to localhost:1025 for local development.
 */
function buildTransport() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: false,
  });
}

/**
 * Send an email. Failures are logged and swallowed so transactional flows do
 * not crash when email delivery is unavailable.
 */
export async function sendEmail({ to, subject, html }) {
  try {
    const transport = buildTransport();
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendEmail failed:', err);
  }
}
