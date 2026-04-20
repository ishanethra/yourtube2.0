import mongoose from "mongoose";
import video from "../Modals/video.js";
import history from "../Modals/history.js";

export const handlehistory = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;

  // Guard: User must be a valid ObjectId. videoId can be a string (for samples).
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid User ID format" });
  }

  try {
    // Force normalize videoId to string to prevent duplicates between ObjectId and String types
    const vidStr = String(videoId);
    
    // History entries use the string ID directly for samples, or ObjectId for native.
    await history.findOneAndUpdate(
      { viewer: userId, videoid: vidStr },
      { $set: { updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    
    // Only increment views if it's a native video (valid ObjectId)
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    }
    
    return res.status(200).json({ history: true });
  } catch (error) {
    console.error("Error in handlehistory:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const handleview = async (req, res) => {
  const { videoId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(200).json({ message: "Sample video view ignored for increment" });
  }

  try {
    await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("View increment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const getallhistoryVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const historyEntries = await history.find({ viewer: userId }).sort({ updatedAt: -1 });
    
    // Manually populate only valid ObjectIds
    const populatedHistory = await Promise.all(historyEntries.map(async (entry) => {
      const entryObj = entry.toObject();
      if (mongoose.Types.ObjectId.isValid(entry.videoid)) {
        const videoData = await video.findById(entry.videoid);
        entryObj.videoid = videoData || entry.videoid; // Replace ID with object if found
      }
      // If not ObjectId (e.g. "gaming-1"), we leave videoid as a string 
      // The frontend will handle looking up sample metadata
      return entryObj;
    }));

    return res.status(200).json(populatedHistory);
  } catch (error) {
    console.error("Fetch History error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteHistoryVideo = async (req, res) => {
  const { historyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(historyId)) {
    return res.status(400).json({ message: "Invalid history ID" });
  }
  try {
    await history.findByIdAndDelete(historyId);
    return res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error("Delete History error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
