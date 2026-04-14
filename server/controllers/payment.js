import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import users from "../Modals/Auth.js";
import paymentModel from "../Modals/payment.js";
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

    if (purpose === "premium_download") {
      user.isPremiumDownloader = true;
    } else {
      user.plan = normalizedPlan;
      user.watchLimitMinutes = PLAN_CONFIG[normalizedPlan].watchMinutes;
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
      subject: "YourTube Invoice & Plan Confirmation",
      text: `Payment successful. Plan: ${planLabel}. Amount: INR ${amount}. Benefit: ${watchLimit}.`,
      html: `<h2>YourTube Invoice</h2><p><b>Plan:</b> ${planLabel}</p><p><b>Amount:</b> INR ${amount}</p><p><b>Benefit:</b> ${watchLimit}</p><p><b>Order ID:</b> ${razorpay_order_id}</p><p><b>Payment ID:</b> ${razorpay_payment_id}</p>`,
    });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Payment verification failed" });
  }
};
