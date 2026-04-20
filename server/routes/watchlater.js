import express from "express";
import {
  getWatchLaterVideos,
  addToWatchLater,
  removeFromWatchLater,
  checkWatchLaterStatus
} from "../controllers/watchlater.js";

const routes = express.Router();

routes.post("/add", addToWatchLater);
routes.get("/:userId", getWatchLaterVideos);
routes.delete("/remove/:videoId/:userId", removeFromWatchLater);
routes.get("/status/:videoId/:userId", checkWatchLaterStatus);

export default routes;
