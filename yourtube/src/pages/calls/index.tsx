import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CallsVideoPage = () => {
  const [roomId, setRoomId] = useState("friends-room");
  const [joined, setJoined] = useState(false);
  const [recording, setRecording] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const setupPeer = () => {
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
  };

  const startLocalMedia = async () => {
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
  };

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

    setJoined(true);
  };

  const shareScreen = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = peerRef.current
      ?.getSenders()
      .find((s) => s.track && s.track.kind === "video");
    if (sender) sender.replaceTrack(videoTrack);
  };

  const startRecording = () => {
    if (!localStreamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(localStreamRef.current);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-recording-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const endCall = () => {
    socketRef.current?.emit("leave-room", roomId);
    socketRef.current?.disconnect();
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    setJoined(false);
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return (
    <main className="flex-1 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Friend Video Calls (VoIP)</h1>
      <p className="text-sm text-gray-600">
        Join the same room ID with your friend. To share a YouTube website specifically: 
        1. Open YouTube in a new tab. 
        2. In this call, click 'Share Screen' and select the 'Chrome Tab' for YouTube.
      </p>

      <div className="flex gap-2 items-center">
        <input
          className="border rounded px-3 py-2"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
        />
        <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={joinRoom} disabled={joined}>
          {joined ? "Joined" : "Join Call"}
        </button>
        <button className="bg-black text-white px-3 py-2 rounded" onClick={shareScreen} disabled={!joined}>
          Share Screen
        </button>
        {!recording ? (
          <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={startRecording} disabled={!joined}>
            Start Recording
          </button>
        ) : (
          <button className="bg-red-600 text-white px-3 py-2 rounded" onClick={stopRecording}>
            Stop Recording
          </button>
        )}
        <button className="bg-gray-700 text-white px-3 py-2 rounded" onClick={endCall}>
          End Call
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="font-medium mb-2">You</p>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded bg-black" />
        </div>
        <div>
          <p className="font-medium mb-2">Friend</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded bg-black" />
        </div>
      </div>
    </main>
  );
};

export default CallsVideoPage;
