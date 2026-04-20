import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from absolute path
dotenv.config({ path: '/Users/nethra/Downloads/you_tube2.0-main/server/.env' });

async function testSMTP() {
  const email = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;

  console.log(`Attempting to send test email using: ${email}`);

  if (!email || !pass) {
    console.error('Missing SMTP credentials in .env');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: email,
      to: email, // Send to self
      subject: 'YourTube SMTP Test',
      text: 'If you receive this, your SMTP configuration is working correctly.',
      html: '<b>YourTube SMTP Test Successful!</b>',
    });
    console.log('SUCCESS: Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('FAILURE: Error sending email:');
    console.error(error);
  }
}

testSMTP();
