import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Video from './Modals/video.js';

dotenv.config({ path: './.env' });
await mongoose.connect(process.env.DB_URL);
const exists = await Video.findOne({ videotitle: 'QA Seed Video' });
if (!exists) {
  const doc = await Video.create({
    videotitle: 'QA Seed Video',
    filename: 'vdo.mp4',
    filetype: 'video/mp4',
    filepath: 'video/vdo.mp4',
    filesize: '30000000',
    videochanel: 'QA Channel',
    uploader: 'qa',
  });
  console.log(doc._id.toString());
} else {
  console.log(exists._id.toString());
}
await mongoose.disconnect();
