"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "./ui/button";
import { 
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, 
  Monitor, MonitorOff, Circle, Square, X, Copy, 
  Users, RefreshCw, PhoneCall, Youtube, ExternalLink, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/AuthContext";
import { io, Socket } from "socket.io-client";

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

export default function VoIPCallManager({ isOpen, onClose }: VoIPCallManagerProps) {
  const { user, handlegooglesignin } = useUser();
  const [roomId,       setRoomId]       = useState("");
  const [joinRoomId,   setJoinRoomId]   = useState("");
  const router = useRouter();
  const [callState,    setCallState]    = useState<"idle"|"preparing"|"lobby"|"calling"|"connected">("idle");
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);
  const [isSharing,    setIsSharing]    = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);
  const [showSyncInput, setShowSyncInput] = useState(false);
  const [syncUrl, setSyncUrl] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef= useRef<MediaStream | null>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const recordChunks   = useRef<Blob[]>([]);
  const durationTimer  = useRef<NodeJS.Timeout | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Sync streams to video elements whenever they unmount/remount
  useEffect(() => {
    let active = true;
    if (active && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    return () => { active = false; };
  }, [callState, localStreamRef.current, isOpen]);

  useEffect(() => {
    let active = true;
    if (active && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    return () => { active = false; };
  }, [callState, remoteStreamRef.current, isOpen]);

  useEffect(() => {
    if (isOpen && router.query.room && callState === "idle") {
      const rid = router.query.room as string;
      setJoinRoomId(rid);
      handleJoinRoom(rid);
    }
  }, [isOpen, router.query.room]);

  const connectWS = (room: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io(resolveWsUrl());
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", room);
      setCallState("lobby");
    });

    socket.on("user-joined", () => {
      toast.info(`A user joined the room`);
      makeOffer(room);
    });

    socket.on("webrtc-offer", async ({ offer }) => {
      const pc = createPeerConnection(room);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { roomId: room, answer });
      setCallState("connected");
      startDurationTimer();
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("connected");
      startDurationTimer();
    });

    socket.on("webrtc-ice-candidate", async ({ candidate }) => {
      if (candidate) await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("user-left", () => {
      toast.error("Participant disconnected");
      endCall();
    });

    socket.on("video-sync", (data) => {
      // Broadcast to GestureVideoPlayer
      window.dispatchEvent(new CustomEvent("youtube-sync-receive", { detail: data }));
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

  const makeOffer = async (room: string) => {
    const pc = createPeerConnection(room);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("webrtc-offer", { roomId: room, offer });
  };

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Local media error:", err);
      toast.error("Could not access camera/mic");
    }
  };

  const handleCreateRoom = async () => {
    if (!user) return toast.error("Sign in to create a meeting");
    try {
      setCallState("preparing");
      await startLocalMedia();
      const id = Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + 
                 Math.random().toString(36).slice(2, 6).toUpperCase();
      setRoomId(id);
      connectWS(id);
      toast.success("Meeting room prepared!");
    } catch { 
      setCallState("idle");
    }
  };

  const copyMeetingLink = () => {
    if (!roomId) return;
    const link = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard");
  };

  const handleJoinRoom = async (overrideId?: string) => {
    if (!user) return toast.error("Sign in to join the meeting");
    const idToJoin = (overrideId || joinRoomId).trim().toUpperCase();
    if (!idToJoin) return toast.error("Enter a room ID");
    try {
      if (callState !== "preparing") {
        setCallState("preparing");
        await startLocalMedia();
      }
      setRoomId(idToJoin);
      setCallState("calling");
      connectWS(idToJoin);
    } catch { 
      setCallState("idle");
    }
  };

  const endCall = () => {
    stopDurationTimer();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    setCallState("idle");
    setCallDuration(0);
    setIsSharing(false);
    toast.info("Call ended");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        pcRef.current?.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(camTrack);
      }
      setIsSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        pcRef.current?.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(screenTrack);
        setIsSharing(true);
        screenTrack.onended = () => toggleScreenShare();
      } catch (err: any) {
        toast.error("Screen share denied");
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecRef.current?.stop();
      setIsRecording(false);
    } else {
      const streams = [
        ...(localStreamRef.current?.getTracks() || []),
        ...(remoteVideoRef.current?.srcObject instanceof MediaStream ? (remoteVideoRef.current.srcObject as MediaStream).getTracks() : []),
      ];
      if (!streams.length) return toast.error("Nothing to record");
      const combined = new MediaStream(streams);
      const rec = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp8,opus" });
      recordChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.current.push(e.data); };
      rec.onstop = () => {
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
    if (durationTimer.current) clearInterval(durationTimer.current);
    durationTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };
  const stopDurationTimer = () => { if (durationTimer.current) clearInterval(durationTimer.current); };
  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#202124] animate-in fade-in duration-300">
      <div className="w-full h-full flex flex-col relative text-white font-sans overflow-hidden">
        
        {/* Top Bar - Only shown in call */}
        {callState === "connected" && (
          <div className="absolute top-0 left-0 p-6 z-10 hidden md:flex items-center gap-3">
            <h1 className="text-lg font-medium text-white/90">Meeting Session</h1>
            <div className="w-[1px] h-4 bg-white/20 mx-2" />
            <span className="text-sm text-white/60 font-mono tracking-wider">{roomId}</span>
          </div>
        )}

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          
          {/* LOBBY / PREPARATION SCREEN */}
          {(callState === "idle" || callState === "preparing" || callState === "lobby" || callState === "calling") && (
            <div className="w-full max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
              
              {/* Left Side: Video Preview */}
              <div className="w-full lg:w-[640px] flex flex-col gap-4">
                <div className="relative aspect-video bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl group border border-white/5">
                  {(isVideoOff || !user) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">
                      <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold uppercase ring-8 ring-blue-600/20">
                        {user?.name?.[0] || "?"}
                      </div>
                    </div>
                  ) : (
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
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
                        {callState === "idle" ? "Start a meeting" : "Ready to join?"}
                      </h1>
                      <p className="text-zinc-400 text-lg">No one else is here yet.</p>
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
                            onClick={() => setCallState(callState === "lobby" ? "connected" : "calling")}
                            className="h-12 px-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-base shadow-xl"
                          >
                            Join now
                          </Button>
                          <Button 
                            onClick={copyMeetingLink}
                            variant="ghost"
                            className="h-12 px-6 rounded-full text-blue-500 hover:bg-blue-500/5 font-medium flex gap-2"
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
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-7xl mx-auto w-full">
                {/* Remote Participant */}
                <div className="relative bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl aspect-video border border-white/5">
                  {/* Remote Video Stream - In a real Meet app, this would show the user's avatar if video is off */}
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-3">
                    <span className="text-white text-xs font-medium bg-black/40 px-3 py-1.5 rounded-md backdrop-blur-md">Participant</span>
                  </div>
                </div>

                {/* Local Participant */}
                <div className="relative bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl aspect-video border border-white/5">
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">
                      <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold uppercase">
                        {user?.name?.[0] || "Y"}
                      </div>
                    </div>
                  ) : (
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
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
                  Present now
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
                onClick={endCall} 
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
              <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {callState === "connected" && (
          <div className="absolute bottom-24 right-4 flex lg:hidden items-center gap-2 z-30">
            <button
              onClick={copyMeetingLink}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all"
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
