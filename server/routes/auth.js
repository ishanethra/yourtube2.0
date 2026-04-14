import express from "express";
import {
  getUserById,
  login,
  startLogin,
  updateprofile,
  verifyLoginOtp,
} from "../controllers/auth.js";
const routes = express.Router();

routes.post("/start-login", startLogin);
routes.post("/verify-otp", verifyLoginOtp);
routes.post("/login", login);
routes.get("/:id", getUserById);
routes.patch("/update/:id", updateprofile);
export default routes;
