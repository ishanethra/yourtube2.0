import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (!transporter) {
    const user = (process.env.SMTP_EMAIL || "").trim();
    const pass = (process.env.SMTP_PASSWORD || "").replace(/\s/g, ""); // Remove any spaces in App Password
    
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
      debug: true, // Show SMTP handshake in Render logs
      logger: true // Comprehensive logging for troubleshooting
    });

    // Verification check to catch issues early in Render logs
    transporter.verify((error, success) => {
      if (error) {
        console.error("FATAL: SMTP Connection failed. Check App Password and Render Environment Variables.", error);
      } else {
        console.log("SUCCESS: SMTP Server is ready to deliver emails.");
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
