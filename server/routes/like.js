import express from "express";
import { handlelike, getallLikedVideo, getInteractionStatus } from "../controllers/like.js";

const routes = express.Router();
routes.get("/status/:videoId/:userId", getInteractionStatus);
routes.get("/:userId", getallLikedVideo);

// Match frontend calls exactly
routes.post("/like/:videoId", handlelike); 
routes.post("/dislike/:videoId", (req, res) => {
  req.body.type = "dislike";
  return handlelike(req, res);
});
export default routes;
