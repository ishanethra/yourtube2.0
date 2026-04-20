import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.error("CRITICAL: SMTP credentials missing in server environment variables.");
    throw new Error("SMTP credentials missing");
  }
  
  try {
    const mailer = getTransporter();
    await mailer.sendMail({ from: process.env.SMTP_EMAIL, to, subject, text, html });
    console.log(`SUCCESS: OTP Email sent to ${to}`);
  } catch (err) {
    console.error("FATAL: NodeMailer failed to send email. Potential Gmail block or invalid App Password.", err);
    throw err;
  }
};
