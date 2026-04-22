import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { 
  Phone, 
  PhoneOff, 
  Video, 
  Monitor, 
  Mic, 
  MicOff, 
  VideoOff, 
  CircleDot,
  Users,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CallsVideoPage = () => {
  const router = useRouter();
  const [roomId, setRoomId] = useState("friends-room");
  const [joined, setJoined] = useState(false);
  const [recording, setRecording] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const queryRoom = router.query.room;
    if (typeof queryRoom === "string" && queryRoom.trim()) {
      setRoomId(queryRoom.trim());
    }
  }, [router.query.room]);

  const setupPeer = useCallback(() => {
    const peer = new RTCPeerConnection(rtcConfig);
    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    peerRef.current = peer;
    return peer;
  }, [roomId]);

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (!peerRef.current) setupPeer();
      stream.getTracks().forEach((track) => peerRef.current?.addTrack(track, stream));
    } catch (err) {
      toast.error("Could not access camera/microphone");
    }
  };

  const endCall = useCallback((showToast = true) => {
    if (recording) stopRecording();
    
    socketRef.current?.emit("leave-room", roomId);
    socketRef.current?.disconnect();
    peerRef.current?.close();
    
    stopLocalMedia();
    
    peerRef.current = null;
    socketRef.current = null;
    
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setJoined(false);
    if (showToast) toast.info("Call ended");
  }, [recording, roomId]);

  const joinRoom = async () => {
    await startLocalMedia();

    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000");
    socketRef.current = socket;

    socket.emit("join-room", roomId);

    socket.on("user-joined", async () => {
      if (!peerRef.current) setupPeer();
      const offer = await peerRef.current!.createOffer();
      await peerRef.current!.setLocalDescription(offer);
      socket.emit("webrtc-offer", { roomId, offer });
    });

    socket.on("webrtc-offer", async ({ offer }) => {
      if (!peerRef.current) setupPeer();
      await peerRef.current!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerRef.current!.createAnswer();
      await peerRef.current!.setLocalDescription(answer);
      socket.emit("webrtc-answer", { roomId, answer });
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc-ice-candidate", async ({ candidate }) => {
      if (candidate) {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("user-left", () => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      toast.info("Your friend left the room");
    });

    setJoined(true);
    toast.success("Joined room: " + roomId);
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = peerRef.current
        ?.getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
      
      videoTrack.onended = () => {
        toast.info("Screen sharing ended");
      };
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = () => {
    if (!localStreamRef.current) {
        toast.error("No local stream to record");
        return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(localStreamRef.current);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-recording-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      chunksRef.current = [];
    };

    recorder.start();
    setRecording(true);
    toast.success("Recording started");
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setRecording(false);
        toast.info("Recording stopped and saved");
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
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

  useEffect(() => {
    return () => {
        // Only run cleanup if necessary
        if (socketRef.current || peerRef.current || localStreamRef.current) {
            // FIX: Don't toast if cleaning up on component destruction unless it was 'joined'
            // However, we want to stop hardware regardless.
            localStreamRef.current?.getTracks().forEach((track) => track.stop());
            socketRef.current?.disconnect();
            peerRef.current?.close();
        }
    };
  }, []);

  return (
    <main className="flex-1 p-3 sm:p-4 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto min-h-screen animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white">
            Premium Video Calls
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">Safe, high-quality VoIP communication</p>
        </div>
        
        <div className="flex items-center gap-2 bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 px-3 sm:px-4 py-2 rounded-2xl border border-blue-200 dark:border-blue-900/50 w-fit">
          <Users className="w-5 h-5" />
          <span className="text-sm font-semibold">RTC Enabled</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4 sm:p-5 rounded-3xl border border-white/50 dark:border-zinc-800/50 backdrop-blur-xl flex flex-col md:flex-row items-stretch gap-4 sm:gap-6 shadow-2xl shadow-indigo-500/5">
        <div className="flex-1 w-full space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Room Identity</label>
          <div className="relative group">
            <input
              className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 sm:px-5 py-3.5 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all pr-12 text-base sm:text-lg font-medium shadow-inner"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="friends-room"
              disabled={joined}
            />
            <Info className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto self-end">
          {!joined ? (
            <Button 
                onClick={joinRoom}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 sm:px-10 h-12 sm:h-14 font-bold text-base sm:text-lg shadow-xl shadow-indigo-500/20 active:scale-95 transition-all w-full md:w-auto"
            >
              <Phone className="w-5 h-5 mr-2 sm:mr-3 fill-current" />
              Join Call
            </Button>
          ) : (
            <>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:mr-2">
                    <Button variant="outline" size="icon" className={cn("rounded-2xl w-11 h-11 sm:w-12 sm:h-12", isAudioMuted && "bg-red-50 border-red-200 text-red-600")} onClick={toggleAudio}>
                        {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    <Button variant="outline" size="icon" className={cn("rounded-2xl w-11 h-11 sm:w-12 sm:h-12", isVideoOff && "bg-red-50 border-red-200 text-red-600")} onClick={toggleVideo}>
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </Button>
                </div>
                
                <Button variant="outline" className="rounded-2xl px-5 sm:px-6 h-11 sm:h-12 font-semibold border-2 w-full sm:w-auto" onClick={shareScreen}>
                    <Monitor className="w-5 h-5 mr-2" />
                    Share
                </Button>

                {!recording ? (
                    <Button variant="secondary" className="rounded-2xl px-5 sm:px-6 h-11 sm:h-12 font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 w-full sm:w-auto" onClick={startRecording}>
                        <CircleDot className="w-5 h-5 mr-2" />
                        Record
                    </Button>
                ) : (
                    <Button variant="destructive" className="rounded-2xl px-5 sm:px-6 h-11 sm:h-12 font-semibold animate-pulse w-full sm:w-auto" onClick={stopRecording}>
                        <CircleDot className="w-5 h-5 mr-2 fill-current" />
                        Stop
                    </Button>
                )}

                <Button variant="destructive" className="bg-red-500 hover:bg-red-600 rounded-2xl px-5 sm:px-6 h-11 sm:h-12 font-bold shadow-lg shadow-red-500/20 w-full sm:w-auto" onClick={() => endCall(true)}>
                    <PhoneOff className="w-5 h-5 mr-2" />
                    End
                </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="group space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                You locally
            </span>
          </div>
          <div className="relative aspect-video rounded-[1.75rem] sm:rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900 overflow-hidden border-[4px] sm:border-[8px] border-white dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all group-hover:shadow-indigo-500/10 group-hover:scale-[1.01]">
             <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", isVideoOff && "opacity-0")} />
             {isVideoOff && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                    <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-4">
                        <VideoOff className="w-8 h-8 text-zinc-400" />
                    </div>
                    <span className="text-zinc-500 font-medium">Camera is off</span>
                 </div>
             )}
          </div>
        </div>

        <div className="group space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                <div className={cn("w-2 h-2 rounded-full", remoteVideoRef.current?.srcObject ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")} />
                Friend remotely
            </span>
          </div>
          <div className="relative aspect-video rounded-[1.75rem] sm:rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900 overflow-hidden border-[4px] sm:border-[8px] border-white dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all group-hover:shadow-emerald-500/10 group-hover:scale-[1.01]">
             <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
             {!remoteVideoRef.current?.srcObject && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 mb-6 relative">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                        <div className="absolute inset-4 rounded-full bg-indigo-500/40 animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Users className="w-8 h-8 text-indigo-500" />
                        </div>
                    </div>
                    <span className="text-indigo-500/70 font-bold text-lg tracking-tight">Waiting for connection...</span>
                    <p className="text-zinc-400 text-sm mt-1">Share the Room ID to start chatting</p>
                 </div>
             )}
          </div>
        </div>
      </div>
      
      <div className="mt-10 sm:mt-12 p-5 sm:p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
        <h4 className="flex items-center gap-2 font-bold mb-4 text-zinc-700 dark:text-zinc-300">
            <Info className="w-5 h-5 text-indigo-500" />
            Quick Guides
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="space-y-2">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 italic">"How do I share YouTube?"</p>
                <p>Simple! Open YouTube in a new tab, come back here, click **Share Screen**, and select the **Chrome Tab** where YouTube is playing. Your friend will see the video in HD!</p>
            </div>
            <div className="space-y-2">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 italic">"Is my data private?"</p>
                <p>Yes. We use Peer-to-Peer (WebRTC) technology, which means your audio and video data is encrypted and sent directly to your friend without touching our servers.</p>
            </div>
        </div>
      </div>
    </main>
  );
};

export default CallsVideoPage;
