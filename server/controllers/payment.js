import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import twilio from "twilio";
import users from "../Modals/Auth.js";
import paymentModel from "../Modals/payment.js";
import otpModel from "../Modals/otp.js";
import { PLAN_CONFIG, normalizePlan } from "../utils/plans.js";
import { sendEmail } from "../utils/notification.js";

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials missing");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const sendMobileOtp = async (mobile, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || "+15017122661";
  
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials missing from environment");
  }

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    body: `Your YourTube Payment Verification OTP is ${otp}. Please do not share this with anyone.`,
    from: fromNumber,
    to: mobile,
  });
};

export const startPaymentOtp = async (req, res) => {
  const { userId, mobile } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await users.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const cleanEmail = user.email ? user.email.toLowerCase().trim() : "";
  const effectiveMobile = (mobile || user.mobile || "").trim();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await otpModel.deleteMany({ email: cleanEmail });
    await otpModel.create({
      email: cleanEmail,
      mobile: effectiveMobile,
      otp,
      expiresAt,
    });

    let deliveryFailed = false;
    try {
      await sendMobileOtp(effectiveMobile, otp);
    } catch (error) {
      console.error("Payment OTP delivery failed:", error);
      deliveryFailed = true;
    }

    return res.status(200).json({
      success: true,
      deliveryFailed,
      debugOtp: deliveryFailed ? otp : undefined,
      message: deliveryFailed ? "OTP delivery failed, use debug code" : "OTP sent to mobile",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to send OTP" });
  }
};

export const verifyPaymentOtp = async (req, res) => {
  const { userId, otp } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const user = await users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const cleanEmail = user.email ? user.email.toLowerCase().trim() : "";
    const otpDoc = await otpModel.findOne({ email: cleanEmail }).sort({ createdAt: -1 });
    if (!otpDoc || otpDoc.otp !== otp || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await otpModel.deleteMany({ email: user.email });
    return res.status(200).json({ success: true, message: "OTP Verified" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Verification failed" });
  }
};

const purposeAmount = (purpose, plan) => {
  if (purpose === "premium_download") return 199;
  return PLAN_CONFIG[plan]?.amount || 0;
};

export const createOrder = async (req, res) => {
  const { userId, plan, purpose = "plan" } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const normalizedPlan = normalizePlan(plan);
    const amount = purposeAmount(purpose, normalizedPlan);

    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid amount for selected option" });
    }

    const razorpay = getRazorpayClient();
    const compactUserId = String(userId).slice(-8);
    const receipt = `yt_${compactUserId}_${Date.now()}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt,
      notes: {
        userId,
        purpose,
        plan: normalizedPlan,
      },
    });

    return res.status(200).json({
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to create order" });
  }
};

export const verifyPayment = async (req, res) => {
  const {
    userId,
    plan,
    purpose = "plan",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment signature mismatch" });
    }

    const normalizedPlan = normalizePlan(plan);
    const amount = purposeAmount(purpose, normalizedPlan);

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Capture verified mobile info from Razorpay transaction
    try {
      const razorpay = getRazorpayClient();
      const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      if (paymentDetails && paymentDetails.contact) {
        user.mobile = paymentDetails.contact;
      }
    } catch (e) {
      console.warn("Could not fetch contact from Razorpay:", e.message);
    }

    if (purpose === "premium_download") {
      user.isPremiumDownloader = true;
    } else {
      user.plan = normalizedPlan;
      const targetMinutes = PLAN_CONFIG[normalizedPlan].watchMinutes;
      // v2.0 Compliance: Direct assignment for 5/7/10/Unlimited minutes
      user.watchLimitMinutes = targetMinutes; 
    }

    await user.save();

    await paymentModel.create({
      userid: userId,
      purpose,
      plan: normalizedPlan,
      amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "success",
    });

    const planLabel = purpose === "premium_download" ? "Premium Download" : normalizedPlan;
    const watchLimit = purpose === "premium_download"
      ? "Unlimited downloads"
      : PLAN_CONFIG[normalizedPlan].watchMinutes === null
      ? "Unlimited watch time"
      : `${PLAN_CONFIG[normalizedPlan].watchMinutes} minutes`;

    await sendEmail({
      to: user.email,
      subject: `YourTube Invoice - ${planLabel}`,
      text: `Order Successful! Plan: ${planLabel}. Amount: ₹${amount}. Benefit: ${watchLimit}. Transaction ID: ${razorpay_payment_id}.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #1a1a1a; padding: 40px; border-radius: 20px; background-color: #000; color: #fff;">
          <h1 style="color: #f59e0b; text-align: center; margin-bottom: 30px;">YourTube Premium Invoice</h1>
          
          <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
            <p><strong>Billed To:</strong> ${user.name} (${user.email})</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #333 text-align: left;">
                <th style="padding: 10px;">Item</th>
                <th style="padding: 10px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px;">YourTube ${planLabel} Subscription</td>
                <td style="padding: 10px; text-align: right;">₹${amount}</td>
              </tr>
            </tbody>
          </table>

          <div style="background-color: #1a1a1a; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin: 0; color: #999;"><strong>Included Benefits:</strong></p>
            <p style="margin: 5px 0 0 0; color: #22c55e;">✔ ${watchLimit}</p>
          </div>

          <div style="font-size: 12px; color: #666; border-top: 1px solid #333; padding-top: 20px;">
            <p><strong>Razorpay Order ID:</strong> ${razorpay_order_id}</p>
            <p><strong>Razorpay Payment ID:</strong> ${razorpay_payment_id}</p>
            <p style="margin-top: 20px; text-align: center;">Thank you for choosing YourTube Premium!</p>
          </div>
        </div>
      `,
    });

    // Fetch fresh user object to ensure all fields are current for the response
    const freshUser = await users.findById(userId).lean();
    return res.status(200).json({ success: true, user: freshUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Payment verification failed" });
  }
};
