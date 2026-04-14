import mongoose from "mongoose";

const otpSchema = mongoose.Schema(
  {
    email: { type: String, index: true },
    mobile: { type: String, index: true },
    otp: { type: String, required: true },
    state: { type: String },
    city: { type: String },
    expiresAt: { type: Date, required: true, index: true },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("otp", otpSchema);
