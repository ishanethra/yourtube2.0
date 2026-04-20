import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true, index: true },
  mobile: { type: String, index: true },
  name: { type: String },
  channelname: { type: String, index: true },
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
  watchedSecondsToday: { type: Number, default: 0 },
  lastWatchDate: { type: String, default: "" }, // Format: YYYY-MM-DD
  isPremiumDownloader: { type: Boolean, default: false },
  subscribers: { type: [mongoose.Schema.Types.ObjectId], ref: "user", default: [] },
  subscribedChannels: { type: [String], default: [] },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
