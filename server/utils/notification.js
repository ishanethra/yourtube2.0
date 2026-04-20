import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (!transporter) {
    const user = (process.env.SMTP_EMAIL || "").trim();
    const pass = (process.env.SMTP_PASSWORD || "").replace(/\s/g, ""); // Remove any spaces in App Password
    
    transporter = nodemailer.createTransport({
      pool: true, // Improved reliability for multiple login attempts
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use STARTTLS (standard for Render/Vercel)
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false // Helps bypass some host-level cert issues
      }
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
