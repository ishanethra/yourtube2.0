import mongoose from "mongoose";
import dotenv from "dotenv";
import Video from "./Modals/video.js";
import Comment from "./Modals/comment.js";

dotenv.config();

const sampleVideos = [
  {
    videotitle: "Advanced Next.js Tutorial",
    filename: "nextjs.mp4",
    filetype: "video/mp4",
    filepath: "uploads/sample1.mp4",
    filesize: "45MB",
    videochanel: "CodeMaster",
    uploader: "Admin",
    Like: 150,
    views: 1200,
  },
  {
    videotitle: "Modern UI/UX Design Trends",
    filename: "design.mp4",
    filetype: "video/mp4",
    filepath: "uploads/sample2.mp4",
    filesize: "32MB",
    videochanel: "DesignHub",
    uploader: "Admin",
    Like: 89,
    views: 750,
  },
  {
    videotitle: "WebRTC End-to-End Guide",
    filename: "webrtc.mp4",
    filetype: "video/mp4",
    filepath: "uploads/sample3.mp4",
    filesize: "55MB",
    videochanel: "AsyncJS",
    uploader: "Admin",
    Like: 230,
    views: 3100,
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB for seeding...");

    await Video.deleteMany({});
    console.log("Cleared existing videos.");

    const createdVideos = await Video.insertMany(sampleVideos);
    console.log(`Inserted ${createdVideos.length} sample videos.`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDB();
