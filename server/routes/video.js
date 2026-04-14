import express from "express";
import {
  getallvideo,
  getUserDownloads,
  requestVideoDownload,
  uploadvideo,
} from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post("/upload", upload.single("file"), uploadvideo);
routes.get("/getall", getallvideo);
routes.post("/download/:videoId", requestVideoDownload);
routes.get("/downloads/:userId", getUserDownloads);
export default routes;
