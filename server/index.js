import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import path from "path";

import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import paymentroutes from "./routes/payment.js";
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
  pingInterval: 25000,
  pingTimeout: 60000,
  allowEIO3: true,
});
const roomParticipants = new Map();

const emitRoomUsers = (roomId) => {
  const users = Array.from(roomParticipants.get(roomId)?.values() || []);
  io.to(roomId).emit("room-users", users);
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use("/uploads", express.static(path.join("uploads")));

app.get("/", (req, res) => {
  res.send("You tube backend is working");
});

app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/download", videoroutes); // Add this
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyroutes); // Fixed typo
app.use("/comment", commentroutes);
app.use("/payment", paymentroutes);

// Global Audit Logger for 404s (Fixes stale code detection)
app.use((req, res, next) => {
  console.log(`[Back-End Audit] Unhandled Request: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Infrastructure mismatch: Route not found on this instance." });
});

// Centralized Strategy Error Handler
app.use((err, req, res, next) => {
  console.error("[Back-End Trace] Operational Failure:", err.stack);
  res.status(500).json({ message: "Stability Interrupted: System error recorded." });
});

io.on("connection", (socket) => {
  socket.on("join-room", (payload) => {
    const roomId = typeof payload === "string" ? payload : payload?.roomId;
    const user = typeof payload === "string" ? null : payload?.user;
    if (!roomId) return;
    const safeUser = {
      socketId: socket.id,
      name: String(user?.name || "Participant"),
      image: String(user?.image || ""),
      isVideoOn: user?.isVideoOn !== false,
      isMuted: !!user?.isMuted,
    };
    if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Map());
    roomParticipants.get(roomId).set(socket.id, safeUser);

    socket.join(roomId);
    socket.to(roomId).emit("user-joined", socket.id);
    emitRoomUsers(roomId);
  });

  socket.on("webrtc-offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("webrtc-offer", { offer });
  });

  socket.on("webrtc-answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("webrtc-answer", { answer });
  });

  socket.on("webrtc-ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("webrtc-ice-candidate", { candidate });
  });

  socket.on("video-sync", ({ roomId, data }) => {
    socket.to(roomId).emit("video-sync", data);
  });

  socket.on("screen-share-state", ({ roomId, isSharing }) => {
    socket.to(roomId).emit("screen-share-state", { isSharing: !!isSharing });
  });

  socket.on("camera-state", ({ roomId, isVideoOn }) => {
    if (roomParticipants.has(roomId) && roomParticipants.get(roomId).has(socket.id)) {
      const user = roomParticipants.get(roomId).get(socket.id);
      user.isVideoOn = !!isVideoOn;
      roomParticipants.get(roomId).set(socket.id, user);
      emitRoomUsers(roomId);
    }
    socket.to(roomId).emit("camera-state", { isVideoOn: !!isVideoOn });
  });

  socket.on("mute-state", ({ roomId, isMuted }) => {
    if (roomParticipants.has(roomId) && roomParticipants.get(roomId).has(socket.id)) {
      const user = roomParticipants.get(roomId).get(socket.id);
      user.isMuted = !!isMuted;
      roomParticipants.get(roomId).set(socket.id, user);
      emitRoomUsers(roomId);
    }
    socket.to(roomId).emit("mute-state", { isMuted: !!isMuted });
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(socket.id);
      if (roomParticipants.get(roomId).size === 0) roomParticipants.delete(roomId);
      else emitRoomUsers(roomId);
    }
    socket.to(roomId).emit("user-left", socket.id);
  });

  socket.on("disconnect", () => {
    for (const [roomId, usersMap] of roomParticipants.entries()) {
      if (usersMap.has(socket.id)) {
        usersMap.delete(socket.id);
        if (usersMap.size === 0) roomParticipants.delete(roomId);
        else emitRoomUsers(roomId);
        socket.to(roomId).emit("user-left", socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

const DBURL = process.env.DB_URL || process.env.MONGO_URL;
if (!DBURL) {
  console.error("FATAL: No Database URL found (DB_URL or MONGO_URL)");
}

mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((error) => {
    console.log(error);
  });
