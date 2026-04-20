import mongoose from "mongoose";

const downloadSchema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: String,
      ref: "videofiles",
      required: true,
    },
    downloadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("download", downloadSchema);
