import mongoose from "mongoose";

const paymentSchema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    purpose: { type: String, enum: ["plan", "premium_download"], required: true },
    plan: { type: String, default: "FREE" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true },
    razorpaySignature: { type: String, required: true },
    status: { type: String, enum: ["success", "failed"], default: "success" },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("payment", paymentSchema);
