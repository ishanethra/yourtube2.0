import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

const testKeys = async () => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log("Attempting to fetch orders with Key ID:", process.env.RAZORPAY_KEY_ID);
    const orders = await razorpay.orders.all({ count: 1 });
    console.log("Successfully connected to Razorpay. Found orders:", orders.items.length);
  } catch (error) {
    console.error("Razorpay Connection Error:", error.message);
  }
};

testKeys();
