import mongoose from "mongoose";
import video from "../Modals/video.js";
import like from "../Modals/like.js";

export const handlelike = async (req, res) => {
  const { userId, type = "like" } = req.body;
  const { videoId } = req.params;

  if (!userId || !videoId) {
    return res.status(400).json({ message: "Invalid user or video ID" });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(videoId);
    const result = { action: "", type, liked: false, totalLikes: 0, totalDislikes: 0 };
    
    // For YouTube samples or non-objectID videos, we just return a success result
    // The frontend handles the toggle locally or we could add a separate YouTubeLike collection
    // removed isObjectId restriction to allow persistence for YouTube samples

    const existing = await like.findOne({ viewer: userId, videoid: videoId });

    if (existing) {
      if (existing.type === type) {
        // Undo: clicking the same button again
        await like.findByIdAndDelete(existing._id);
        if (mongoose.Types.ObjectId.isValid(videoId)) {
          const updateField = type === "like" ? "Like" : "Dislike";
          // Use $max: 0 safety to ensure it never goes below 0
          await video.findByIdAndUpdate(videoId, { 
            $inc: { [updateField]: -1 } 
          });
          // Fix potential negative value in DB after decrement
          await video.updateOne({ _id: videoId, [updateField]: { $lt: 0 } }, { $set: { [updateField]: 0 } });
        }
        result.action = "removed";
        result.liked = false;
      } else {
        // Switch: e.g., from dislike to like
        const oldType = existing.type;
        existing.type = type;
        await existing.save();

        if (mongoose.Types.ObjectId.isValid(videoId)) {
          const decField = oldType === "like" ? "Like" : "Dislike";
          const incField = type === "like" ? "Like" : "Dislike";

          await video.findByIdAndUpdate(videoId, { 
            $inc: { [decField]: -1, [incField]: 1 } 
          });
          // Fix potential negative value in DB after decrement
          await video.updateOne({ _id: videoId, [decField]: { $lt: 0 } }, { $set: { [decField]: 0 } });
        }
        result.action = "switched";
        result.from = oldType;
        result.to = type;
        result.liked = type === "like";
      }
    } else {
      // New interaction
      await like.create({ viewer: userId, videoid: videoId, type });
      if (mongoose.Types.ObjectId.isValid(videoId)) {
        const incField = type === "like" ? "Like" : "Dislike";
        await video.findByIdAndUpdate(videoId, { $inc: { [incField]: 1 } });
      }
      result.action = "added";
      result.liked = type === "like";
    }

    // Always fetch and return the latest counts
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      const vidDoc = await video.findById(videoId);
      if (vidDoc) {
        result.totalLikes = vidDoc.Like || 0;
        result.totalDislikes = vidDoc.Dislike || 0;
      }
    } else {
      // Aggregate counts from like collection for virtual/sample videos
      result.totalLikes = await like.countDocuments({ videoid: videoId, type: "like" });
      result.totalDislikes = await like.countDocuments({ videoid: videoId, type: "dislike" });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Interaction error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getInteractionStatus = async (req, res) => {
  const { videoId, userId } = req.params;
  try {
    const interaction = await like.findOne({ viewer: userId, videoid: videoId });
    
    let totalLikes = 0;
    let totalDislikes = 0;

    if (mongoose.Types.ObjectId.isValid(videoId)) {
      const vidDoc = await video.findById(videoId);
      totalLikes = vidDoc?.Like || 0;
      totalDislikes = vidDoc?.Dislike || 0;
    } else {
      totalLikes = await like.countDocuments({ videoid: videoId, type: "like" });
      totalDislikes = await like.countDocuments({ videoid: videoId, type: "dislike" });
    }

    return res.status(200).json({
      isLiked: interaction?.type === "like",
      isDisliked: interaction?.type === "dislike",
      totalLikes,
      totalDislikes
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching status" });
  }
};

export const getallLikedVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const likeEntries = await like.find({ viewer: userId, type: "like" }).sort({ createdAt: -1 });
    
    // Manually populate only valid ObjectIds to avoid CastErrors for samples
    const populatedLikes = await Promise.all(likeEntries.map(async (entry) => {
      const entryObj = entry.toObject();
      if (mongoose.Types.ObjectId.isValid(entry.videoid)) {
        const videoData = await video.findById(entry.videoid);
        entryObj.videoid = videoData || entry.videoid; // Replace ID with object if found
      }
      return entryObj;
    }));

    return res.status(200).json(populatedLikes);
  } catch (error) {
    console.error("Fetch Liked error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
