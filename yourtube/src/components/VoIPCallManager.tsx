"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "./ui/button";
import { 
  PhoneOff, Video, VideoOff, Mic, MicOff, 
  Monitor, MonitorOff, Circle, Square, X, Copy, 
  Users, Youtube, MessageSquare, Minimize2, Maximize2,
  AppWindow, MonitorUp
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/AuthContext";
import { io, Socket } from "socket.io-client";
import { useAppStatus } from "@/lib/ContextManager";

const resolveWsUrl = () => {
  if (process.env.NEXT_PUBLIC_VOIP_WS_URL) return process.env.NEXT_PUBLIC_VOIP_WS_URL;
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:5000`;
  return "http://localhost:5000";
};

interface VoIPCallManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

interface RoomUser {
  socketId: string;
  name: string;
  image: string;
  isVideoOn: boolean;
  isMuted: boolean;
}

const parseMeetingCodeOrLink = (rawInput: string) => {
  const raw = String(rawInput || "").trim();
  if (!raw) return "";

  // Accept plain room code
  if (!raw.includes("://")) return raw.toUpperCase();

  // Accept full /calls?room=XXXX links
  try {
    const url = new URL(raw);
    const roomFromQuery = url.searchParams.get("room");
    if (roomFromQuery) return roomFromQuery.trim().toUpperCase();
    const maybeLastPath = url.pathname.split("/").filter(Boolean).pop() || "";
    return maybeLastPath.toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
};

export default function VoIPCallManager({ isOpen, onClose }: VoIPCallManagerProps) {
  const { user, handlegooglesignin } = useUser();
  const [roomId,       setRoomId]       = useState("");
  const [joinRoomId,   setJoinRoomId]   = useState("");
  const router = useRouter();
  const [callState,    setCallState]    = useState<"idle"|"preparing"|"lobby"|"calling"|"connected">("idle");
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remotePresent, setRemotePresent] = useState(false);
  const [isSharing,    setIsSharing]    = useState(false);
  const [remoteIsSharing, setRemoteIsSharing] = useState(false);
  const { isCallMinimized: isMinimized, setIsCallMinimized: setIsMinimized } = useAppStatus() as any;
  const [isRecording,  setIsRecording]  = useState(false);
  const [showSyncInput, setShowSyncInput] = useState(false);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [syncUrl, setSyncUrl] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [hasLocalPreview, setHasLocalPreview] = useState(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef= useRef<MediaStream | null>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const recordChunks   = useRef<Blob[]>([]);
  const recordingFrameRef = useRef<number | null>(null);
  const composedStreamRef = useRef<MediaStream | null>(null);
  const composedAudioCtxRef = useRef<AudioContext | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnimRef = useRef<number | null>(null);
  const durationTimer  = useRef<NodeJS.Timeout | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef(""); // stable ref so callbacks don't capture stale roomId
  const socketRoomRef = useRef("");
  const socketConnectInFlightRef = useRef(false);
  const sharedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const localAvatar = String(user?.image || "").trim();

  const refreshLocalPreviewState = useCallback(() => {
    const liveVideoTrack = localStreamRef.current
      ?.getVideoTracks()
      ?.some((track) => track.readyState === "live");
    setHasLocalPreview(Boolean(liveVideoTrack) && !isVideoOff);
  }, [isVideoOff]);

  const attachLocalPreview = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (node && localStreamRef.current) {
      node.srcObject = localStreamRef.current;
      node.play().catch(() => null);
    }
  }, []);

  // Sync streams to video elements whenever they unmount/remount
  // By adding layout states to dependencies, this re-runs immediately after React mounts new <video> nodes
  useEffect(() => {
    let active = true;
    if (active && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => null);
    }
    return () => { active = false; };
  }, [callState, isOpen, isVideoOff, isSharing, remotePresent, remoteIsSharing]);

  useEffect(() => {
    let active = true;
    if (active && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => null);
    }
    return () => { active = false; };
  }, [callState, isOpen, remoteVideoOff, remotePresent, remoteIsSharing, isSharing]);

  const endCall = useCallback((silent = false) => {
    if (durationTimer.current) clearInterval(durationTimer.current);
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit("screen-share-state", { roomId: roomIdRef.current, isSharing: false });
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;
    screenStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current = null;
    socketRef.current = null;

    // Release camera/mic hardware — clears the browser's camera indicator
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    roomIdRef.current = "";
    socketRoomRef.current = "";
    socketConnectInFlightRef.current = false;
    setCallState("idle");
    setCallDuration(0);
    setIsSharing(false);
    setRemoteIsSharing(false);
    setRemoteVideoOff(false);
    setRemotePresent(false);
    setIsMinimized(false);
    setMicLevel(0);
    setHasLocalPreview(false);
    setRoomUsers([]);
    if (!silent) {
      toast.info("Call ended");
      onClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    if (isOpen && router.query.room && callState === "idle") {
      const rid = router.query.room as string;
      setJoinRoomId(rid);
      handleJoinRoom(rid);
    }
  // handleJoinRoom is stable enough — including it would cause infinite re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, router.query.room, callState]);

  const connectWS = (room: string) => {
    if (socketConnectInFlightRef.current && socketRoomRef.current === room) return;
    if (socketRef.current?.connected && socketRoomRef.current === room) return;

    if (socketRef.current && socketRoomRef.current && socketRoomRef.current !== room) {
      socketRef.current.disconnect();
    }

    socketConnectInFlightRef.current = true;
    socketRoomRef.current = room;

    const socket = io(resolveWsUrl(), {
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      withCredentials: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socketConnectInFlightRef.current = false;
      socket.emit("join-room", {
        roomId: room,
        user: {
          name: user?.name || "Participant",
          image: user?.image || "",
          isVideoOn: !isVideoOff,
          isMuted,
        },
      });
      socket.emit("camera-state", { roomId: room, isVideoOn: !isVideoOff });
      setCallState("connected");
      startDurationTimer();
    });

    socket.on("connect_error", () => {
      socketConnectInFlightRef.current = false;
      setCallState("calling");
      toast.error("Realtime server reconnecting. Stay on this screen.");
    });

    socket.on("disconnect", () => {
      socketConnectInFlightRef.current = false;
    });

    socket.on("user-joined", () => {
      toast.info(`A user joined the room`);
      setRemotePresent(true);
      makeOffer(room);
    });

    socket.on("webrtc-offer", async ({ offer }) => {
      const pc = createPeerConnection(room);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { roomId: room, answer });
      setRemotePresent(true);
      setCallState("connected");
      startDurationTimer();
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setRemotePresent(true);
      setCallState("connected");
      startDurationTimer();
    });

    socket.on("webrtc-ice-candidate", async ({ candidate }) => {
      if (candidate) await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("user-left", () => {
      toast.info("Participant disconnected");
      setRemoteIsSharing(false);
      setRemoteVideoOff(false);
      setRemotePresent(false);
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => t.stop());
        remoteStreamRef.current = new MediaStream();
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    });

    socket.on("video-sync", (data) => {
      // Broadcast to GestureVideoPlayer
      window.dispatchEvent(new CustomEvent("youtube-sync-receive", { detail: data }));
    });

    socket.on("screen-share-state", ({ isSharing }) => {
      setRemoteIsSharing(Boolean(isSharing));
    });

    socket.on("camera-state", ({ isVideoOn }) => {
      setRemoteVideoOff(!Boolean(isVideoOn));
    });

    socket.on("mute-state", ({ isMuted: remoteMuted }) => {
      if (remoteMuted) toast.info("Participant muted");
    });

    socket.on("room-users", (users: RoomUser[]) => {
      setRoomUsers(Array.isArray(users) ? users : []);
    });
  };

  useEffect(() => {
    const handleLocalSync = (e: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("video-sync", { roomId, data: e.detail });
      }
    };
    window.addEventListener("youtube-sync-send", handleLocalSync);
    return () => window.removeEventListener("youtube-sync-send", handleLocalSync);
  }, [roomId]);

  const createPeerConnection = useCallback((room: string) => {
    if (pcRef.current) pcRef.current.close();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    // Keep receive lanes for remote media even when local camera/mic are off.
    try { pc.addTransceiver("video", { direction: "recvonly" }); } catch {}
    try { pc.addTransceiver("audio", { direction: "recvonly" }); } catch {}

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }

    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }
    const remoteStream = remoteStreamRef.current;
    
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    pc.ontrack = (e) => { 
      e.streams[0].getTracks().forEach(t => {
        if (!remoteStream.getTracks().find(tr => tr.id === t.id)) {
          remoteStream.addTrack(t);
        }
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit("webrtc-ice-candidate", { roomId: room, candidate: e.candidate });
      }
    };

    return pc;
  }, []);

  const getVideoSender = () => {
    const pc = pcRef.current;
    if (!pc) return null;
    const senderWithTrack = pc.getSenders().find((s) => s.track?.kind === "video");
    if (senderWithTrack) return senderWithTrack;
    const tx = pc.getTransceivers().find((t) => t.receiver?.track?.kind === "video");
    return tx?.sender ?? null;
  };

  const makeOffer = async (room: string) => {
    const pc = createPeerConnection(room);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("webrtc-offer", { roomId: room, offer });
  };

  const startLocalMedia = async () => {
    try {
      if (localStreamRef.current) {
        refreshLocalPreviewState();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      if (localVideoRef.current) {
        localVideoRef.current.play().catch(() => null);
      }
      refreshLocalPreviewState();
    } catch (err) {
      console.error("Local media error:", err);
      toast.error("Could not access camera/mic");
      setHasLocalPreview(false);
    }
  };

  const stopMicMeter = useCallback(() => {
    if (micAnimRef.current) {
      cancelAnimationFrame(micAnimRef.current);
      micAnimRef.current = null;
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
      micAudioCtxRef.current.close().catch(() => null);
    }
    micAudioCtxRef.current = null;
    setMicLevel(0);
  }, []);

  const startMicMeter = useCallback((stream: MediaStream | null) => {
    stopMicMeter();
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    const audioContext = new AudioContext();
    micAudioCtxRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const src = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      const avg = sum / data.length;
      setMicLevel(Math.min(100, Math.round((avg / 255) * 100)));
      micAnimRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [stopMicMeter]);

  const handleCreateRoom = async () => {
    if (!user) return toast.error("Sign in to create a meeting");
    try {
      setCallState("preparing");
      await startLocalMedia();
      const id = Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + 
                 Math.random().toString(36).slice(2, 6).toUpperCase();
      setRoomId(id);
      roomIdRef.current = id; // keep ref in sync
      
      // Sync room ID to URL so reloading or sharing works out-of-the-box
      router.replace({ pathname: router.pathname, query: { ...router.query, room: id } }, undefined, { shallow: true });
      
      // Enter meeting room immediately and show waiting state.
      setCallState("calling");
      startDurationTimer();
      connectWS(id);
      toast.success("Meeting room prepared!");
    } catch (e) { 
      console.error(e);
      setCallState("idle");
    }
  };

  const copyMeetingLink = () => {
    if (!roomId) return;
    const link = `${window.location.origin}/calls?room=${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard");
  };

  const handleJoinRoom = async (overrideId?: string) => {
    if (!user) return toast.error("Sign in to join the meeting");
    const idToJoin = parseMeetingCodeOrLink(overrideId || joinRoomId);
    if (!idToJoin) return toast.error("Enter a room ID");
    try {
      if (callState !== "preparing") {
        setCallState("preparing");
        await startLocalMedia();
      }
      setRoomId(idToJoin);
      roomIdRef.current = idToJoin; // keep ref in sync
      
      // Sync room ID to URL so reloading or sharing works out-of-the-box
      if (router.query.room !== idToJoin) {
        router.replace({ pathname: router.pathname, query: { ...router.query, room: idToJoin } }, undefined, { shallow: true });
      }

      // Enter meeting view immediately while signaling connects.
      setCallState("calling");
      startDurationTimer();
      connectWS(idToJoin);
    } catch (e) { 
      console.error(e);
      setCallState("idle");
    }
  };

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current && !isSharing) return;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    sharedVideoTrackRef.current = null;
    if (localScreenVideoRef.current) {
      localScreenVideoRef.current.srcObject = null;
    }
    const sender = getVideoSender();
    const camTrack = localStreamRef.current?.getVideoTracks()?.[0] ?? null;
    if (sender) {
      sender.replaceTrack(camTrack ?? null).catch(() => null);
    } else if (camTrack && pcRef.current && localStreamRef.current) {
      pcRef.current.addTrack(camTrack, localStreamRef.current);
    }
    setIsSharing(false);
    // Use roomIdRef so this callback is never stale even when roomId state lags
    if (socketRef.current?.connected && roomIdRef.current) {
      socketRef.current.emit("screen-share-state", { roomId: roomIdRef.current, isSharing: false });
    }
    toast.info("Screen sharing stopped");
  }, [isSharing]);

  const stopComposedRecorderResources = useCallback(() => {
    if (recordingFrameRef.current) {
      cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }
    composedStreamRef.current?.getTracks().forEach((t) => t.stop());
    composedStreamRef.current = null;
    if (composedAudioCtxRef.current && composedAudioCtxRef.current.state !== "closed") {
      composedAudioCtxRef.current.close().catch(() => null);
    }
    composedAudioCtxRef.current = null;
  }, []);

  const buildComposedMeetingStream = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const remoteEl = remoteVideoRef.current;
    const localEl = localVideoRef.current;
    const localScreenEl = localScreenVideoRef.current;

    const drawVideoCover = (videoEl: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
      const vw = videoEl.videoWidth || w;
      const vh = videoEl.videoHeight || h;
      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.drawImage(videoEl, dx, dy, dw, dh);
    };

    const draw = () => {
      ctx.fillStyle = "#202124";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const remoteReady = !!remoteEl && remoteEl.readyState >= 2;
      const localReady = !!localEl && localEl.readyState >= 2;
      const localScreenReady = !!localScreenEl && localScreenEl.readyState >= 2;

      const anyScreenShareActive = remoteIsSharing || (isSharing && localScreenReady);
      if (anyScreenShareActive) {
        if (remoteIsSharing && remoteReady && remoteEl) {
          drawVideoCover(remoteEl, 0, 0, canvas.width, canvas.height);
        } else if (isSharing && localScreenReady && localScreenEl) {
          drawVideoCover(localScreenEl, 0, 0, canvas.width, canvas.height);
        }
        const pipW = 320;
        const pipH = 180;
        const pipX = canvas.width - pipW - 24;
        const pipY = canvas.height - pipH - 24;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(pipX, pipY, pipW, pipH);
        if (localReady && localEl) {
          drawVideoCover(localEl, pipX, pipY, pipW, pipH);
        } else {
          ctx.fillStyle = "#8ab4f8";
          ctx.font = "bold 32px sans-serif";
          ctx.fillText((user?.name?.[0] || "Y").toUpperCase(), pipX + pipW / 2 - 10, pipY + pipH / 2 + 12);
        }
      } else {
        const colW = canvas.width / 2;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, colW - 1, canvas.height);
        ctx.fillRect(colW + 1, 0, colW - 1, canvas.height);

        if (remoteReady && remoteEl) {
          drawVideoCover(remoteEl, 0, 0, colW, canvas.height);
        }
        if (localReady && localEl) {
          drawVideoCover(localEl, colW, 0, colW, canvas.height);
        } else {
          ctx.fillStyle = "#8ab4f8";
          ctx.font = "bold 42px sans-serif";
          ctx.fillText((user?.name?.[0] || "Y").toUpperCase(), colW + colW / 2 - 14, canvas.height / 2 + 16);
        }
      }

      recordingFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);
    const composed = new MediaStream();
    const vTrack = canvasStream.getVideoTracks()[0];
    if (vTrack) composed.addTrack(vTrack);

    const audioContext = new AudioContext();
    composedAudioCtxRef.current = audioContext;
    const audioDest = audioContext.createMediaStreamDestination();

    const connectAudioTracks = (stream?: MediaStream | null) => {
      if (!stream) return;
      stream.getAudioTracks().forEach((track) => {
        try {
          const src = audioContext.createMediaStreamSource(new MediaStream([track]));
          src.connect(audioDest);
        } catch {
          // no-op: skip invalid tracks
        }
      });
    };

    connectAudioTracks(localStreamRef.current);
    connectAudioTracks(remoteStreamRef.current);
    connectAudioTracks(screenStreamRef.current);

    audioDest.stream.getAudioTracks().forEach((t) => composed.addTrack(t));
    composedStreamRef.current = composed;
    return composed;
  }, [isSharing, remoteIsSharing, user?.name]);

  const startScreenShare = useCallback(async (surfaceType: "browser" | "window" | "monitor" = "browser") => {
    try {
      if (isSharing) return;
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: surfaceType,
          frameRate: 30,
        } as MediaTrackConstraints,
        audio: true,
        preferCurrentTab: surfaceType === "browser",
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
      screenStreamRef.current = stream;
      if (localScreenVideoRef.current) {
        localScreenVideoRef.current.srcObject = stream;
        localScreenVideoRef.current.play().catch(() => null);
      }
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        toast.error("No shareable screen track found.");
        return;
      }
      sharedVideoTrackRef.current = screenTrack;
      screenTrack.contentHint = "detail";
      const sender = getVideoSender();
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else if (pcRef.current) {
        pcRef.current.addTrack(screenTrack, stream);
      }
      setIsSharing(true);
      setShowSharePicker(false);
      if (socketRef.current?.connected && roomIdRef.current) {
        socketRef.current.emit("screen-share-state", { roomId: roomIdRef.current, isSharing: true });
      }
      if (surfaceType === "browser") {
        setIsMinimized(true);
        toast.success("Call minimized. You can navigate this website while sharing.");
      }
      screenTrack.onended = () => stopScreenShare();
      toast.success("Screen share started");
    } catch {
      toast.error("Screen share cancelled or denied");
    }
  }, [isSharing, stopScreenShare]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        if (socketRef.current?.connected && roomIdRef.current) {
          socketRef.current.emit("mute-state", { roomId: roomIdRef.current, isMuted: !audioTrack.enabled });
        }
      }
    }
  };

  const toggleVideo = async () => {
    try {
      if (!localStreamRef.current) {
        await startLocalMedia();
      }
      const stream = localStreamRef.current;
      if (!stream) return;

      if (!isVideoOff) {
        // Turn OFF completely: stop/remove all camera tracks so hardware is released in background too.
        stream.getVideoTracks().forEach((track) => {
          track.stop();
          stream.removeTrack(track);
        });

        if (!isSharing) {
          const sender = getVideoSender();
          if (sender) await sender.replaceTrack(null);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }

        setIsVideoOff(true);
        setHasLocalPreview(false);
      if (socketRef.current?.connected && roomId) {
        socketRef.current.emit("camera-state", { roomId, isVideoOn: false });
      }
        return;
      }

      // Turn ON: reacquire fresh track and attach everywhere.
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const freshTrack = camStream.getVideoTracks()[0];
      if (!freshTrack) return;

      // Cleanup any stale tracks before adding the new live track.
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
      stream.addTrack(freshTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => null);
      }

      if (!isSharing) {
        const sender = getVideoSender();
        if (sender) await sender.replaceTrack(freshTrack);
      }

      setIsVideoOff(false);
      refreshLocalPreviewState();
      if (socketRef.current?.connected && roomId) {
        socketRef.current.emit("camera-state", { roomId, isVideoOn: true });
      }
    } catch (err) {
      toast.error("Could not toggle camera. Check camera permission.");
    }
  };

  const toggleScreenShare = async () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      setShowSharePicker(true);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecRef.current?.stop();
      setIsRecording(false);
    } else {
      const composed = buildComposedMeetingStream();
      if (!composed || !composed.getVideoTracks().length) {
        return toast.error("Nothing to record");
      }
      const rec = new MediaRecorder(composed, { mimeType: "video/webm;codecs=vp8,opus" });
      recordChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.current.push(e.data); };
      rec.onstop = () => {
        stopComposedRecorderResources();
        const blob = new Blob(recordChunks.current, { type: "video/webm" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `recording-${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Recording saved!");
      };
      rec.start();
      mediaRecRef.current = rec;
      setIsRecording(true);
      toast.success("Recording full meeting view");
    }
  };

  const handleSyncYoutube = () => {
    if (!syncUrl.trim()) return setShowSyncInput(false);
    
    // Extract ID (supports youtu.be, youtube.com/watch?v=, etc.)
    const matches = syncUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{10,12})/);
    const videoId = matches ? matches[1] : syncUrl.trim();
    
    if (videoId) {
      // Broadcast the sync to everyone in the room
      if (socketRef.current?.connected) {
        socketRef.current.emit("video-sync", { 
          roomId, 
          data: { action: "load", youtubeId: videoId, time: 0 } 
        });
        toast.success("Streaming video to participants...");
      }
      setShowSyncInput(false);
      setSyncUrl("");
    }
  };

  const startDurationTimer = () => {
    // Guard: never stack up multiple timers
    if (durationTimer.current) return;
    durationTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };
  const stopDurationTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  };
  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const participantCount = Math.max(roomUsers.length, remotePresent ? 2 : 1);
  const remoteUser = roomUsers.find((u) => u.socketId !== socketRef.current?.id);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        mediaRecRef.current.stop();
      }
      stopMicMeter();
      stopComposedRecorderResources();
      endCall(true);
    };
  }, [endCall, stopComposedRecorderResources, stopMicMeter]);

  useEffect(() => {
    if (!isOpen || !user) return;
    if (callState !== "idle") return;
    startLocalMedia().then(() => {
      startMicMeter(localStreamRef.current);
    });
  }, [isOpen, user, callState, startMicMeter]);

  if (!isOpen) return null;

  const isMeetingActive = callState === "preparing" || callState === "calling" || callState === "connected";

  if (isMinimized && isMeetingActive) {
    return (
      <div className="fixed bottom-4 right-4 z-[120] w-80 rounded-2xl border border-white/15 bg-[#202124]/95 backdrop-blur-md shadow-2xl text-white p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold tracking-wide truncate">{roomId || "Meeting"}</p>
          <button
            onClick={() => setIsMinimized(false)}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            title="Restore Call"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-zinc-300 mb-3">
          {callState !== "connected"
            ? "Connecting in background..."
            : isSharing
            ? "You are sharing this tab."
            : "Call is running in background."}
        </p>
        <div className="grid grid-cols-6 gap-2 mb-3">
          <button
            onClick={toggleMute}
            disabled={callState !== "connected"}
            className={`h-9 rounded-lg flex items-center justify-center ${isMuted ? "bg-red-600/90" : "bg-white/10 hover:bg-white/20"}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleVideo}
            disabled={callState !== "connected"}
            className={`h-9 rounded-lg flex items-center justify-center ${isVideoOff ? "bg-red-600/90" : "bg-white/10 hover:bg-white/20"}`}
            title={isVideoOff ? "Start video" : "Stop video"}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleScreenShare}
            disabled={callState !== "connected"}
            className={`h-9 rounded-lg flex items-center justify-center ${isSharing ? "bg-blue-600/90" : "bg-white/10 hover:bg-white/20"}`}
            title={isSharing ? "Stop sharing" : "Share screen"}
          >
            {isSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleRecording}
            disabled={callState !== "connected"}
            className={`h-9 rounded-lg flex items-center justify-center ${isRecording ? "bg-red-600/90" : "bg-white/10 hover:bg-white/20"}`}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
          </button>
          <button
            onClick={copyMeetingLink}
            className="h-9 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20"
            title="Copy meeting link"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSyncInput((v) => !v)}
            disabled={callState !== "connected"}
            className={`h-9 rounded-lg flex items-center justify-center ${showSyncInput ? "bg-red-600/90" : "bg-white/10 hover:bg-white/20"}`}
            title="Stream YouTube"
          >
            <Youtube className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold"
          >
            Open Call
          </button>
          <button
            onClick={() => endCall()}
            className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-semibold"
          >
            End
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#202124] animate-in fade-in duration-300">
      <div className="w-full h-full flex flex-col relative text-white font-sans overflow-hidden">
        
        {/* Top Bar - Only shown in call */}
        {callState === "connected" && (
          <div className="absolute top-0 left-0 p-6 z-10 hidden md:flex items-center gap-3">
            <h1 className="text-lg font-medium text-white/90">Meeting Session</h1>
            <div className="w-[1px] h-4 bg-white/20 mx-2" />
            <span className="text-sm text-white/60 font-mono tracking-wider">{roomId}</span>
            <div className="w-[1px] h-4 bg-white/20 mx-2" />
            <span className="text-sm text-white/60">{participantCount} participant{participantCount > 1 ? "s" : ""}</span>
          </div>
        )}

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          
          {/* LOBBY / PREPARATION SCREEN */}
          {(callState === "idle" || callState === "preparing" || callState === "lobby" || callState === "calling") && (
            <div className="w-full max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
              
              {/* Left Side: Video Preview */}
              <div className="w-full lg:w-[640px] flex flex-col gap-4">
                <div className="relative aspect-video bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl group border border-white/5">
                  {(isVideoOff || !user || !hasLocalPreview) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">
                      {localAvatar ? (
                        <img
                          src={localAvatar}
                          alt={user?.name || "Your profile"}
                          className="w-24 h-24 rounded-full object-cover ring-8 ring-blue-600/20 border border-white/20"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold uppercase ring-8 ring-blue-600/20">
                          {user?.name?.[0] || "?"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <video ref={attachLocalPreview} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                  )}
                  
                  {/* Preview Mic/Cam indicators */}
                  {user && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                      <button 
                        onClick={toggleMute} 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-[#ea4335] text-white" : "bg-white/10 hover:bg-white/20 text-white border border-white/20"}`}
                      >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={toggleVideo} 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? "bg-[#ea4335] text-white" : "bg-white/10 hover:bg-white/20 text-white border border-white/20"}`}
                      >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Join Controls */}
              <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-8">
                {!user ? (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-normal text-white">Join Meeting</h1>
                    <p className="text-zinc-400 text-lg">Sign in with your Google account to get started.</p>
                    <Button 
                      onClick={handlegooglesignin}
                      className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-base shadow-lg transition-all"
                    >
                      Sign in to Participate
                    </Button>
                  </div>
                ) : (
                  <div className="w-full max-w-md space-y-8">
                    <div className="space-y-4">
                      <h1 className="text-4xl font-normal text-white">
                        {callState === "idle" ? "Start a meeting" : "Connecting..."}
                      </h1>
                      <p className="text-zinc-400 text-lg">Share your room code and invite your friend.</p>
                      {callState === "idle" && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-zinc-300">Mic Test</span>
                            <span className="text-zinc-400">{micLevel}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                micLevel > 70 ? "bg-emerald-400" : micLevel > 35 ? "bg-amber-400" : "bg-blue-400"
                              }`}
                              style={{ width: `${micLevel}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-2">Speak to check if your microphone is working before joining.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {callState === "idle" ? (
                        <div className="grid gap-4">
                          <Button 
                            onClick={handleCreateRoom}
                            className="h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-base flex items-center justify-center gap-3"
                          >
                            <Video className="w-5 h-5" /> New Meeting
                          </Button>
                          <div className="flex gap-2">
                            <input
                              value={joinRoomId} onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                              placeholder="Enter a code or link"
                              className="flex-1 bg-transparent border border-white/20 rounded-lg px-4 text-white h-12 outline-none focus:border-blue-500 transition-all font-sans"
                            />
                            <Button 
                              onClick={() => handleJoinRoom()}
                              disabled={!joinRoomId}
                              className="h-12 px-6 rounded-lg bg-white/5 text-blue-500 hover:bg-white/10 font-medium disabled:opacity-50"
                            >
                              Join
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <Button 
                            onClick={copyMeetingLink}
                            variant="ghost"
                            className="h-12 px-6 rounded-full text-blue-500 hover:bg-blue-500/5 font-medium flex gap-2 border border-blue-500/30"
                          >
                            <Copy className="w-4 h-4" /> Share Link
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACTIVE CALL VIEW (Video Grid) */}
          {callState === "connected" && (
            <div className="w-full h-full flex flex-col md:p-6 mb-20 transition-all duration-500">
              {!remotePresent && (
                <div className="mb-3 mx-auto w-full max-w-7xl rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 flex items-center justify-between gap-3">
                  <span>Waiting for participants to join this meeting...</span>
                  <button
                    onClick={copyMeetingLink}
                    className="text-xs px-3 py-1 rounded-full border border-blue-300/40 hover:bg-blue-400/20 transition-all"
                  >
                    Copy Invite Link
                  </button>
                </div>
              )}
              <div
                className={`flex-1 ${
                  remotePresent
                    ? remoteIsSharing
                      ? "relative"
                      : "flex flex-col md:flex-row"
                    : "flex flex-col items-center justify-center p-2 lg:p-8"
                } gap-4 max-w-7xl mx-auto w-full h-full min-h-0`}
              >
                {/* Remote Participant */}
                {remotePresent && (
                <div className={`relative bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl border border-white/5 ${
                  remoteIsSharing ? "w-full h-full absolute inset-0" : "flex-1 min-h-0 w-full"
                }`}>
                  {/* Remote Video Stream - In a real Meet app, this would show the user's avatar if video is off */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover transition-opacity ${remoteVideoOff ? "opacity-0" : "opacity-100"}`}
                  />
                  {remoteVideoOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                      {remoteUser?.image ? (
                        <img src={remoteUser.image} alt={remoteUser?.name || "Participant"} className="w-20 h-20 rounded-full object-cover border border-white/20" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-zinc-600 flex items-center justify-center text-2xl font-bold uppercase">
                          {remoteUser?.name?.[0] || "P"}
                        </div>
                      )}
                      <p className="mt-3 text-sm text-zinc-300">
                        {(remoteUser?.name || "Participant")} camera is off
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 flex items-center gap-3">
                    <span className="text-white text-xs font-medium bg-black/40 px-3 py-1.5 rounded-md backdrop-blur-md">
                      {remoteIsSharing
                        ? `${remoteUser?.name || "Participant"} • Sharing Screen`
                        : remoteVideoOff
                        ? `${remoteUser?.name || "Participant"} • Camera Off`
                        : `${remoteUser?.name || "Participant"} • Connected`}
                    </span>
                  </div>
                </div>
                )}

                {/* Local Participant */}
                <div className={`relative bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl border border-white/5 ${
                  remotePresent && remoteIsSharing
                    ? "absolute right-4 bottom-4 w-32 md:w-64 aspect-[3/4] md:aspect-video z-20"
                    : remotePresent 
                      ? "flex-1 min-h-0 w-full" 
                      : "w-full max-w-5xl flex-1 min-h-0"
                }`}>
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">
                      {localAvatar ? (
                        <img
                          src={localAvatar}
                          alt={user?.name || "Your profile"}
                          className="w-20 h-20 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold uppercase">
                          {user?.name?.[0] || "Y"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <video ref={attachLocalPreview} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                  )}
                  <div className="absolute bottom-4 left-4 flex items-center gap-3">
                    <span className="text-white text-xs font-medium bg-black/40 px-3 py-1.5 rounded-md backdrop-blur-md">
                      You {isSharing && "• Sharing"}
                    </span>
                    {isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROL BAR (Only in call) */}
        {callState === "connected" && (
          <div className="absolute bottom-0 inset-x-0 h-20 bg-[#202124] flex items-center justify-between px-6 z-20 border-t border-white/5">
            {/* Left Info */}
            <div className="hidden lg:flex items-center gap-3 min-w-[200px]">
              <span className="text-sm font-medium text-white/90 font-mono tracking-widest">{formatDuration(callDuration)}</span>
              <div className="w-[1px] h-4 bg-white/20" />
              <span className="text-sm text-white/60 font-medium tracking-tight">Meeting ID: {roomId}</span>
            </div>

            {/* Center Controls */}
            <div className="flex items-center gap-3 mx-auto">
              <button 
                onClick={toggleMute} 
                className={`group relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-[#ea4335] text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white"}`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3c4043] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {isMuted ? "Unmute (Ctrl+D)" : "Mute (Ctrl+D)"}
                </span>
              </button>

              <button 
                onClick={toggleVideo} 
                className={`group relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? "bg-[#ea4335] text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white"}`}
              >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3c4043] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {isVideoOff ? "Start Video (Ctrl+E)" : "Stop Video (Ctrl+E)"}
                </span>
              </button>

              <button 
                onClick={toggleScreenShare} 
                className={`group relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isSharing ? "bg-blue-600 text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white"}`}
              >
                {isSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3c4043] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Share screen
                </span>
              </button>

              <button 
                onClick={toggleRecording} 
                className={`group relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-[#ea4335] animate-pulse" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white"}`}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Circle className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3c4043] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {isRecording ? "Stop Recording" : "Record Meeting"}
                </span>
              </button>

              <button 
                onClick={() => setShowSyncInput(!showSyncInput)} 
                className={`group relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${showSyncInput ? "bg-red-600 text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white"}`}
              >
                <Youtube className="w-5 h-5" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#3c4043] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                   Stream YouTube
                </span>
              </button>

              <div className="w-[1px] h-6 bg-white/10 mx-1" />

              <button
                onClick={() => setIsMinimized(true)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#3c4043] hover:bg-[#4a4e51] flex items-center justify-center transition-all"
                title="Minimize call"
              >
                <Minimize2 className="w-5 h-5 text-white" />
              </button>

              <button 
                onClick={() => endCall()} 
                className="w-16 md:w-20 h-10 md:h-12 rounded-full bg-[#ea4335] hover:bg-[#d93025] flex items-center justify-center transition-all shadow-lg active:scale-95"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Right Tools */}
            <div className="hidden lg:flex items-center gap-2 min-w-[200px] justify-end">
              <button 
                onClick={copyMeetingLink}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all">
                <Users className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all">
                <MessageSquare className="w-4 h-4" />
              </button>
              <button onClick={() => endCall()} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all ml-2" title="End call and close">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {isMeetingActive && (
          <div className="absolute bottom-24 right-4 flex lg:hidden items-center gap-2 z-30">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all"
              title="Minimize call"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={copyMeetingLink}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => endCall()}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all"
              title="End call and close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* YouTube Sync Input Overlay */}
        {showSyncInput && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#202124] border border-white/10 rounded-2xl p-6 shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-white text-sm font-black mb-4 uppercase tracking-widest italic flex items-center gap-3">
              <Youtube className="w-5 h-5 text-red-600" /> Live Stream Sync
            </h3>
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="Paste YouTube URL or Video ID" 
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-red-600/50 transition-all font-bold"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSyncYoutube()}
              />
              <button 
                onClick={handleSyncYoutube}
                className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest italic hover:bg-zinc-200 transition-all"
              >
                Sync
              </button>
            </div>
            <p className="text-[9px] text-zinc-500 mt-4 leading-relaxed italic">
              * This will automatically play the selected video for all participants in the meeting room.
            </p>
          </div>
        )}

        {/* Screen Share Picker Overlay */}
        {showSharePicker && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-sm bg-[#202124] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-white text-base font-bold mb-3 pl-2">Share your screen</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startScreenShare("browser")}
                className="text-left rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10 transition-all flex items-center gap-3"
              >
                <Monitor className="w-4 h-4 text-zinc-400" />
                Chrome Tab
                <span className="text-xs text-zinc-500 font-normal ml-auto">Best for video</span>
              </button>
              <button
                onClick={() => startScreenShare("window")}
                className="text-left rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10 transition-all flex items-center gap-3"
              >
                <AppWindow className="w-4 h-4 text-zinc-400" />
                Window
              </button>
              <button
                onClick={() => startScreenShare("monitor")}
                className="text-left rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10 transition-all flex items-center gap-3"
              >
                <MonitorUp className="w-4 h-4 text-zinc-400" />
                Entire Screen
              </button>
            </div>
            <button
              onClick={() => setShowSharePicker(false)}
              className="mt-4 w-full bg-[#ea4335]/20 text-[#ea4335] border border-[#ea4335]/30 rounded-xl px-4 py-2 hover:bg-[#ea4335]/30 transition-all text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        <video
          ref={localScreenVideoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />

        {/* Floating Close Button for non-call states */}
        {callState !== "connected" && (
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-all z-50 border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <style jsx>{`
        .mirror { transform: scaleX(-1); }
      `}</style>
    </div>
  );
}
