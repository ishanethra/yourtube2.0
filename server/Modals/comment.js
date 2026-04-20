import mongoose from "mongoose";
const commentschema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: String,
      required: true,
    },
    commentbody: { type: String },
    usercommented: { type: String },
    userimage: { type: String },
    city: { type: String, default: "Unknown" },
    language: { type: String, default: "en" },
    languageName: { type: String, default: "English" },
    detectedLang: { type: String },
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "comment", default: null },
    commentedon: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("comment", commentschema);
