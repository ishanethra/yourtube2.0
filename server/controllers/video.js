import mongoose from "mongoose";
import video from "../Modals/video.js";
import users from "../Modals/Auth.js";
import downloadModel from "../Modals/download.js";
import path from "path";
import fs from "fs";

export const uploadvideo = async (req, res) => {
  if (req.files === undefined || req.files.file === undefined) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file" });
  }

  try {
    const videoFile = req.files.file[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    const file = new video({
      videotitle: req.body.videotitle,
      filename: videoFile.originalname,
      filepath: videoFile.path,
      filetype: videoFile.mimetype,
      filesize: videoFile.size,
      videochanel: req.body.videochanel,
      uploader: req.body.uploader,
      thumbnailPath: thumbnailFile ? thumbnailFile.path : null,
    });
    await file.save();
    return res.status(201).json("file uploaded successfully");
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallvideo = async (req, res) => {
  try {
    const files = await video.find().populate("uploader");
    return res.status(200).send(files);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
};

export const requestVideoDownload = async (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.body;

  // For sample videos, videoId might be "music-1" etc.
  const isSampleVideo = 
    videoId.startsWith("music-") || 
    videoId.startsWith("gaming-") || 
    videoId.startsWith("movies-") || 
    videoId.startsWith("news-") ||
    videoId.startsWith("sports-") ||
    videoId.startsWith("tech-") ||
    videoId.startsWith("comedy-") ||
    videoId.startsWith("education-") ||
    videoId.startsWith("science-") ||
    videoId.startsWith("travel-") ||
    videoId.startsWith("food-") ||
    videoId.startsWith("fashion-");

  const isValidVideoId = isSampleVideo || mongoose.Types.ObjectId.isValid(videoId);

  if (!isValidVideoId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    let targetVideo = null;
    const user = await users.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isSampleVideo) {
       // Check if sample video exists in database (user-uploaded samples)
       // or just handle as virtual sample
       targetVideo = await video.findOne({ _id: videoId }).catch(() => null);
    } else {
       targetVideo = await video.findById(videoId);
    }

    if (!targetVideo && !isSampleVideo) {
      return res.status(404).json({ message: "Video not found" });
    }

    // 1. Duplicate Check for In-App Library
    const existing = await downloadModel.findOne({ userid: userId, videoid: videoId });
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: "This video is already in your downloads section!",
        title: targetVideo ? targetVideo.videotitle : videoId,
      });
    }

    // 2. Premium Limit Check
    // Bronze (Rank 1) and above, or legacy isPremiumDownloader get unlimited
    const isPremium = user.isPremiumDownloader || (user.plan && user.plan !== "FREE");
    
    if (!isPremium) {
      const { start, end } = getTodayRange();
      const todayCount = await downloadModel.countDocuments({
        userid: userId,
        downloadedAt: { $gte: start, $lt: end },
      });
      if (todayCount >= 1) { // Free users get 1 download per day
        return res.status(403).json({
          message: "Free users can save only 1 video to library per day. Upgrade to premium for unlimited!",
        });
      }
    }

    // 3. Add to In-App Library (applies to both uploaded and sample videos)
    const entry = await downloadModel.create({
      userid: userId,
      videoid: videoId,
      downloadedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      download: entry,
      fileUrl: isSampleVideo ? null : undefined,
      message: "Successfully added to your downloads section! You can view it in the sidebar.",
      title: targetVideo ? targetVideo.videotitle : videoId,
      isSample: isSampleVideo,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getUserDownloads = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const downloads = await downloadModel
      .find({ userid: userId })
      .lean();

    // Populate manually to handle both ObjectIds and sample Strings
    const populatedDownloads = await Promise.all(downloads.map(async (item) => {
      if (mongoose.Types.ObjectId.isValid(item.videoid)) {
        item.videoid = await video.findById(item.videoid);
      } else {
        // It's a sample video ID string
        // We'll return it as is, and the frontend will resolve it from its own sample list
      }
      return item;
    }));

    return res.status(200).json(populatedDownloads);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const downloadVideoStream = async (req, res) => {
  const { videoId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: "Invalid video id for real download" });
    }

    const targetVideo = await video.findById(videoId);
    if (!targetVideo || !targetVideo.filepath) {
      return res.status(404).json({ message: "Video file not found" });
    }

    const absolutePath = path.resolve(targetVideo.filepath);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Physical file missing on server" });
    }

    const fileName = targetVideo.filename || `${targetVideo.videotitle}.mp4`;
    
    res.download(absolutePath, fileName, (err) => {
      if (err) {
        console.error("Download error:", err);
        if (!res.headersSent) {
          res.status(500).send("Error downloading file");
        }
      }
    });
  } catch (error) {
    console.error("Stream download error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const checkDownloadStatus = async (req, res) => {
  const { videoId, userId } = req.body;
  if (!videoId || !userId) return res.status(200).json({ downloaded: false });

  try {
    const existing = await downloadModel.findOne({ userid: userId, videoid: videoId });
    return res.status(200).json({ downloaded: !!existing });
  } catch (error) {
    return res.status(200).json({ downloaded: false });
  }
};
