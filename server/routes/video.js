import express from "express";
import {
  getallvideo,
  getUserDownloads,
  requestVideoDownload,
  uploadvideo,
  downloadVideoStream,
  checkDownloadStatus,
} from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadvideo
);
routes.get("/getall", getallvideo);
routes.post("/download/:videoId", requestVideoDownload);
routes.post("/check", checkDownloadStatus);
routes.get("/download-file/:videoId", downloadVideoStream);
routes.get("/downloads/:userId", getUserDownloads);
export default routes;
