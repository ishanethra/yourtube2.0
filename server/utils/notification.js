import nodemailer from "nodemailer";

const getTransporter = () => {
  const user = (process.env.SMTP_EMAIL || "").trim();
  const pass = (process.env.SMTP_PASSWORD || "").replace(/\s/g, "");
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2" },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const smtpEmail = (process.env.SMTP_EMAIL || "").trim();
  const smtpPass = (process.env.SMTP_PASSWORD || "").replace(/\s/g, "");

  if (!smtpEmail || !smtpPass) {
    console.error("CRITICAL: SMTP credentials missing in server environment variables.");
    throw new Error("SMTP credentials missing");
  }
  
  try {
    const mailer = getTransporter();
    await mailer.verify();
    await mailer.sendMail({
      from: `"YourTube" <${smtpEmail}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`SUCCESS: OTP Email sent to ${to}`);
  } catch (err) {
    console.error("FATAL: NodeMailer failed to send email. Check SMTP_EMAIL, SMTP_PASSWORD, and Gmail App Password settings.", err);
    throw err;
  }
};
