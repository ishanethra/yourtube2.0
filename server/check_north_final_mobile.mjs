import dotenv from 'dotenv';
import mongoose from 'mongoose';
import otpModel from './Modals/otp.js';

dotenv.config({ path: './.env' });
await mongoose.connect(process.env.DB_URL);
const doc = await otpModel.findOne({ email: 'north.final@example.com' }).sort({ createdAt: -1 });
console.log(doc ? doc.mobile : 'NO_DOC');
await mongoose.disconnect();
