import comment from "../Modals/comment.js";
import users from "../Modals/Auth.js";
import mongoose from "mongoose";

const VALID_COMMENT_REGEX = /^[\p{L}\p{N}\s]+$/u;

export const postcomment = async (req, res) => {
  const commentdata = req.body;

  if (!VALID_COMMENT_REGEX.test((commentdata.commentbody || "").trim())) {
    return res.status(400).json({ message: "Special characters are not allowed in comments" });
  }

  try {
    const user = await users.findById(commentdata.userid);
    const postcomment = new comment({
      ...commentdata,
      city: commentdata.city || user?.city || "Unknown",
      language: commentdata.language || "auto",
    });
    await postcomment.save();
    return res.status(200).json({ comment: true, data: postcomment });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  try {
    const commentvideo = await comment.find({ videoid }).sort({ createdAt: -1 });
    return res.status(200).json(commentvideo);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    await comment.findByIdAndDelete(_id);
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }

  if (!VALID_COMMENT_REGEX.test((commentbody || "").trim())) {
    return res.status(400).json({ message: "Special characters are not allowed in comments" });
  }

  try {
    const updatecomment = await comment.findByIdAndUpdate(
      _id,
      {
        $set: { commentbody },
      },
      { new: true }
    );
    res.status(200).json(updatecomment);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const toggleCommentLike = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid ids" });
  }

  try {
    const target = await comment.findById(id);
    if (!target) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const alreadyLiked = target.likedBy.some((entry) => entry.toString() === userId);
    if (alreadyLiked) {
      target.likedBy = target.likedBy.filter((entry) => entry.toString() !== userId);
      target.likes = Math.max(0, target.likes - 1);
    } else {
      target.likedBy.push(userId);
      target.likes += 1;
      if (target.dislikedBy.some((entry) => entry.toString() === userId)) {
        target.dislikedBy = target.dislikedBy.filter((entry) => entry.toString() !== userId);
        target.dislikes = Math.max(0, target.dislikes - 1);
      }
    }

    await target.save();
    return res.status(200).json({ data: target });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const toggleCommentDislike = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid ids" });
  }

  try {
    const target = await comment.findById(id);
    if (!target) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (target.userid.toString() === userId) {
      return res
        .status(400)
        .json({ message: "You cannot dislike your own comment" });
    }

    const alreadyDisliked = target.dislikedBy.some((entry) => entry.toString() === userId);
    if (alreadyDisliked) {
      target.dislikedBy = target.dislikedBy.filter((entry) => entry.toString() !== userId);
      target.dislikes = Math.max(0, target.dislikes - 1);
    } else {
      target.dislikedBy.push(userId);
      target.dislikes += 1;
      if (target.likedBy.some((entry) => entry.toString() === userId)) {
        target.likedBy = target.likedBy.filter((entry) => entry.toString() !== userId);
        target.likes = Math.max(0, target.likes - 1);
      }
    }

    if (target.dislikes >= 2) {
      await comment.findByIdAndDelete(id);
      return res.status(200).json({ removed: true });
    }

    await target.save();
    return res.status(200).json({ data: target, removed: false });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const translateComment = async (req, res) => {
  const { id } = req.params;
  const { to } = req.query;

  if (!to) {
    return res.status(400).json({ message: "Target language is required" });
  }

  try {
    const target = await comment.findById(id);
    if (!target) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(
      target.commentbody
    )}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("Translate API failed");
    }

    const data = await response.json();
    const translated = data?.[0]?.map((part) => part?.[0]).join("") || target.commentbody;

    return res.status(200).json({
      translated,
      original: target.commentbody,
      language: to,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Translation unavailable right now" });
  }
};
