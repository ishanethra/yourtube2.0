import express from "express";
import {
  getUserById,
  login,
  startLogin,
  subscribeChannel,
  unsubscribeChannel,
  updateprofile,
  verifyLoginOtp,
  updateWatchTime,
  getSubscriptionStatus,
  subscribeChannelBody,
  updateWatchTimeBody,
} from "../controllers/auth.js";
const routes = express.Router();

routes.post("/start-login", startLogin);
routes.post("/verify-otp", verifyLoginOtp);
routes.post("/login", login);

// Specific action routes BEFORE generic wildcard :id
routes.get("/subscription-status/:channelId/:userId", getSubscriptionStatus);
routes.post("/subscribe", subscribeChannelBody);
routes.post("/watch-time/update", updateWatchTimeBody);

routes.get("/:id", getUserById);
routes.patch("/update/:id", updateprofile);
routes.post("/subscribe/:id", subscribeChannel);
routes.post("/unsubscribe/:id", unsubscribeChannel);
routes.patch("/update-watch-time/:id", updateWatchTime);
export default routes;
