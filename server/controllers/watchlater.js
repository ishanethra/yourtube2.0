import watchlater from "../Modals/watchlater.js";
import video from "../Modals/video.js";
import mongoose from "mongoose";

export const addToWatchLater = async (req, res) => {
  const { videoid, userid } = req.body;
  try {
    const existing = await watchlater.findOne({ viewer: userid, videoid: videoid });
    if (!existing) {
      await watchlater.create({ viewer: userid, videoid: videoid });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const removeFromWatchLater = async (req, res) => {
  const { videoId, userId } = req.params;
  try {
    await watchlater.findOneAndDelete({ viewer: userId, videoid: videoId });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const checkWatchLaterStatus = async (req, res) => {
  const { videoId, userId } = req.params;
  try {
    const existing = await watchlater.findOne({ viewer: userId, videoid: videoId });
    return res.status(200).json({ saved: !!existing });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getWatchLaterVideos = async (req, res) => {
  const { userId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(200).json([]); // Return empty if ID is invalid (e.g. guest or undefined)
  }

  try {
    const watchlatervideo = await watchlater.find({ viewer: userId });
    
    // Manual Hydration to support YouTube samples (Mixed IDs)
    const hydrated = await Promise.all(watchlatervideo.map(async (entry) => {
      const entryObj = entry.toObject();
      if (mongoose.Types.ObjectId.isValid(entry.videoid)) {
        const videoData = await video.findById(entry.videoid);
        entryObj.videoid = videoData || entry.videoid;
      }
      return entryObj;
    }));

    return res.status(200).json(hydrated);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
