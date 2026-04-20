import express from "express";
import { createOrder, verifyPayment, startPaymentOtp, verifyPaymentOtp } from "../controllers/payment.js";

const routes = express.Router();

routes.post("/create-order", createOrder);
routes.post("/verify", verifyPayment);
routes.post("/start-otp", startPaymentOtp);
routes.post("/verify-otp", verifyPaymentOtp);

export default routes;
