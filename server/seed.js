import mongoose from "mongoose";
import dotenv from "dotenv";
import Video from "./Modals/video.js";
import Comment from "./Modals/comment.js";

dotenv.config();

const sampleVideos = [];

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
