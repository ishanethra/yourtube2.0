import mongoose from "mongoose";
import video from "../Modals/video.js";
import users from "../Modals/Auth.js";
import downloadModel from "../Modals/download.js";

export const uploadvideo = async (req, res) => {
  if (req.file === undefined) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file only" });
  }

  try {
    const file = new video({
      videotitle: req.body.videotitle,
      filename: req.file.originalname,
      filepath: req.file.path,
      filetype: req.file.mimetype,
      filesize: req.file.size,
      videochanel: req.body.videochanel,
      uploader: req.body.uploader,
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
    const files = await video.find();
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

  if (!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    const [targetVideo, user] = await Promise.all([
      video.findById(videoId),
      users.findById(userId),
    ]);

    if (!targetVideo || !user) {
      return res.status(404).json({ message: "Video or user not found" });
    }

    if (!user.isPremiumDownloader) {
      const { start, end } = getTodayRange();
      const todayCount = await downloadModel.countDocuments({
        userid: userId,
        downloadedAt: { $gte: start, $lt: end },
      });
      if (todayCount >= 1) {
        return res.status(403).json({
          message: "Free users can download only one video per day. Upgrade to premium for unlimited downloads.",
        });
      }
    }

    const entry = await downloadModel.create({
      userid: userId,
      videoid: videoId,
    });

    return res.status(200).json({
      success: true,
      download: entry,
      fileUrl: `${process.env.BACKEND_URL}/${targetVideo.filepath}`,
      title: targetVideo.videotitle,
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
      .populate({ path: "videoid", model: "videofiles" })
      .sort({ downloadedAt: -1 });

    return res.status(200).json(downloads);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
