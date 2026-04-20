import express from "express";
import {
  getallhistoryVideo,
  handlehistory,
  handleview,
  deleteHistoryVideo,
} from "../controllers/history.js";

const routes = express.Router();
routes.get("/:userId", getallhistoryVideo);
routes.post("/views/:videoId", handleview);
routes.post("/handlehistory/:videoId", handlehistory);
routes.delete("/:historyId", deleteHistoryVideo);
export default routes;
