import express from "express";
import {
  deletecomment,
  editcomment,
  getallcomment,
  postcomment,
  votecomment,
  translatecomment,
} from "../controllers/comment.js";

const routes = express.Router();

routes.get("/all/:videoid", getallcomment);
routes.post("/postcomment", postcomment);
routes.delete("/:id", deletecomment);
routes.patch("/:id", editcomment);
routes.post("/:id/vote", votecomment);
routes.get("/:id/translate", translatecomment);

export default routes;
