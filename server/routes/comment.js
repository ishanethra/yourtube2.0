import express from "express";
import {
  deletecomment,
  editcomment,
  getallcomment,
  postcomment,
  toggleCommentDislike,
  toggleCommentLike,
  translateComment,
} from "../controllers/comment.js";
const routes = express.Router();
routes.get("/:videoid", getallcomment);
routes.post("/postcomment", postcomment);
routes.delete("/deletecomment/:id", deletecomment);
routes.post("/editcomment/:id", editcomment);
routes.post("/like/:id", toggleCommentLike);
routes.post("/dislike/:id", toggleCommentDislike);
routes.get("/translate/:id", translateComment);
export default routes;
