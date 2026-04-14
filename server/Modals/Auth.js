import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  mobile: { type: String },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  state: { type: String },
  city: { type: String },
  loginOtpMode: { type: String, enum: ["email", "mobile"], default: "mobile" },
  plan: {
    type: String,
    enum: ["FREE", "BRONZE", "SILVER", "GOLD"],
    default: "FREE",
  },
  watchLimitMinutes: { type: Number, default: 5 },
  isPremiumDownloader: { type: Boolean, default: false },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
