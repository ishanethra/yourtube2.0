"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { 
  FastForward, 
  Rewind, 
  Play, 
  Pause, 
  SkipForward, 
  MessageSquare,
  LogOut,
  Clock,
  Lock,
  Maximize
} from "lucide-react";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
    youtubeId?: string;
  };
  maxWatchMinutes?: number | null;
  onNext?: () => void;
  onOpenComments?: () => void;
}

type Zone = "left" | "center" | "right";

const DOUBLE_TAP_MS = 280;

export default function VideoPlayer({
  video,
  maxWatchMinutes,
  onNext,
  onOpenComments,
}: VideoPlayerProps) {
  // Use a fallback to prevent destructuring errors if useUser returns null
  const auth = useUser();
  const user = auth?.user;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tapCount, setTapCount] = useState(0);
  const [lastZone, setLastZone] = useState<Zone | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [watchEnded, setWatchEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  
  // Feedback state
  const [feedback, setFeedback] = useState<{ type: string; zone: Zone } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = (type: string, zone: Zone) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback({ type, zone });
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 800);
  };

  const handleAction = (count: number, zone: Zone) => {
    if (!videoRef.current && count < 3) return;

    if (count === 1) {
      if (zone === "center" && videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => null);
          showFeedback("play", "center");
        } else {
          videoRef.current.pause();
          showFeedback("pause", "center");
        }
      }
    } else if (count === 2) {
      if (zone === "center") {
        // Center Double Tap: Fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => null);
          showFeedback("window", "center");
        } else if (containerRef.current) {
          containerRef.current.requestFullscreen().catch(() => {
            console.warn("Local player fullscreen blocked.");
          });
          showFeedback("fullscreen", "center");
        }
      } else if (videoRef.current) {
        if (zone === "left") {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          showFeedback("rewind", "left");
        } else if (zone === "right") {
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration || Infinity,
            videoRef.current.currentTime + 10
          );
          showFeedback("forward", "right");
        }
      }
    } else if (count >= 3) {
      if (zone === "center") {
        showFeedback("next", "center");
        onNext?.();
      } else if (zone === "left") {
        if (onOpenComments) {
          if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
              setTimeout(() => onOpenComments(), 100);
            }).catch(() => onOpenComments());
          } else {
            onOpenComments();
          }
          showFeedback("comments", "left");
        }
      } else if (zone === "right") {
        showFeedback("exit", "right");
        setIsExiting(true);
        setTimeout(() => {
          window.location.href = "about:blank";
          window.close();
        }, 2500);
      }
    }
  };

  const onPlayerClick = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const third = rect.width / 3;
    const zone: Zone = x < third ? "left" : x > third * 2 ? "right" : "center";

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (zone === lastZone) {
      const newCount = tapCount + 1;
      if (newCount === 3) {
        handleAction(3, zone);
        setTapCount(0);
        setLastZone(null);
        clickTimeoutRef.current = null;
      } else {
        setTapCount(newCount);
        setLastZone(zone);
        clickTimeoutRef.current = setTimeout(() => {
          handleAction(newCount, zone);
          setTapCount(0);
          setLastZone(null);
        }, DOUBLE_TAP_MS);
      }
    } else {
      setTapCount(1);
      setLastZone(zone);
      clickTimeoutRef.current = setTimeout(() => {
        handleAction(1, zone);
        setTapCount(0);
        setLastZone(null);
      }, DOUBLE_TAP_MS);
    }
  };

  const isYoutubeSample = Boolean(video?.youtubeId);

  // Fetch initial watch time and sync heartbeat
  useEffect(() => {
    if (!video?._id || !user?._id) return;

    let localAccrued = 0;

    const fetchInitialTime = async () => {
      try {
        const res = await axiosInstance.get(`/user/${user._id}`);
        // Backend now returns remainingSeconds in the response
        const limitMins = res.data.result?.watchLimitMinutes; 
        
        // Handle Unlimited (null or explicitly very high)
        if (limitMins === null || limitMins > 1000) {
           setTimeLeft(999999);
           return;
        }

        const limitSeconds = limitMins * 60;
        const watchedSeconds = res.data.result?.watchedSecondsToday || 0;
        const initialRemaining = Math.max(0, limitSeconds - watchedSeconds);
        
        setTimeLeft(initialRemaining);
        if (initialRemaining <= 0) {
           setWatchEnded(true);
        }
      } catch (error) {
        console.error("DEBUG: Failed to fetch initial watch time", error);
        setTimeLeft(300);
      }
    };

    fetchInitialTime();

    const syncHeartbeat = async (seconds: number) => {
      if (!user?._id) return;
      try {
        const res = await axiosInstance.patch(`/user/update-watch-time/${user._id}`, {
          incrementSeconds: Math.floor(seconds)
        });
        if (res.data.remainingSeconds !== undefined) {
          setTimeLeft(res.data.remainingSeconds);
          if (res.data.remainingSeconds <= 0) {
            setWatchEnded(true);
            if (videoRef.current) videoRef.current.pause();
          }
        }
      } catch (error) {
        console.error("DEBUG: Heartbeat sync failed", error);
      }
    };

    const interval = setInterval(() => {
      const isPlaying = isYoutubeSample ? !watchEnded : (videoRef.current && !videoRef.current.paused && !videoRef.current.ended);
      const isUnlimited = timeLeft && timeLeft > 86400; // More than a day left is considered unlimited UI-wise
      
      if (isPlaying && !watchEnded && timeLeft !== null && !isUnlimited) {
        setTimeLeft(prev => {
          if (prev === null) return null;
          const newTime = Math.max(0, prev - 1);
          if (newTime <= 0) {
            setWatchEnded(true);
            if (videoRef.current) videoRef.current.pause();
          }
          return newTime;
        });

        localAccrued += 1;
        if (localAccrued >= 10) {
          syncHeartbeat(localAccrued);
          localAccrued = 0;
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (localAccrued > 0) {
        syncHeartbeat(localAccrued); // Final sync on unmount
      }
    };
  }, [video?._id, user?._id, isYoutubeSample, watchEnded, timeLeft]);

  const source =
    video?.filepath?.startsWith("video/") || video?.filepath?.startsWith("/video/")
      ? `/${video.filepath.replace(/^\/+/, "")}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/${video?.filepath}`;

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative group aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-100 dark:border-white/10 ring-1 ring-black/5"
      >
        {watchEnded ? (
          <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative bg-zinc-800 p-6 rounded-3xl border border-white/10 shadow-2xl">
                <Lock className="w-12 h-12 text-red-500 animate-bounce" />
              </div>
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2 text-white">
              Limit Reached
            </h2>
            <p className="text-zinc-400 text-sm max-w-[280px] mb-6 font-medium leading-relaxed">
              Your free preview has ended. Upgrade now to unlock unlimited high-speed streaming.
            </p>
            <a 
              href="/plans"
              className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full hover:scale-105 transition-transform shadow-xl active:scale-95"
            >
              Upgrade to Premium
            </a>
          </div>
        ) : isYoutubeSample ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
            title={video.videotitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <>
            <video
              key={video?._id}
              ref={videoRef}
              className="w-full h-full object-cover"
              controls={false}
              autoPlay
              muted
              poster="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop"
            >
              <source src={source} type="video/mp4" />
            </video>

            {/* Fullscreen Button */}
            <div className="absolute inset-x-0 bottom-0 py-10 px-4 flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none">
              <button
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white pointer-events-auto hover:bg-black/60 hover:scale-110 transition-all flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => null);
                    showFeedback("window", "center");
                  } else if (containerRef.current) {
                    containerRef.current.requestFullscreen().catch(() => null);
                    showFeedback("fullscreen", "center");
                  }
                }}
              >
                <Maximize className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Gesture Overlay */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={onPlayerClick}
            />

            {/* Visual Feedback Overlays */}
            {feedback && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                <div className={`flex flex-col items-center justify-center animate-in zoom-in fade-in duration-300 ${
                  feedback.zone === "left" ? "mr-auto ml-10" : 
                  feedback.zone === "right" ? "ml-auto mr-10" : ""
                }`}>
                  <div className="bg-white/20 backdrop-blur-xl p-6 rounded-full border border-white/30 shadow-2xl">
                    {feedback.type === "play" && <Play className="w-12 h-12 text-white fill-white" />}
                    {feedback.type === "pause" && <Pause className="w-12 h-12 text-white fill-white" />}
                    {feedback.type === "fullscreen" && <div className="flex flex-col items-center text-white"><span className="text-2xl font-black italic">🎥 FULLSCREEN</span></div>}
                    {feedback.type === "window" && <div className="flex flex-col items-center text-white"><span className="text-2xl font-black italic">📺 WINDOW</span></div>}
                    {feedback.type === "forward" && <div className="flex flex-col items-center"><FastForward className="w-12 h-12 text-white fill-white" /><span className="text-white font-black text-xs mt-1">+10s</span></div>}
                    {feedback.type === "rewind" && <div className="flex flex-col items-center"><Rewind className="w-12 h-12 text-white fill-white" /><span className="text-white font-black text-xs mt-1">-10s</span></div>}
                    {feedback.type === "next" && <div className="flex flex-col items-center"><SkipForward className="w-12 h-12 text-white fill-white" /><span className="text-white font-black text-xs mt-1 italic">NEXT</span></div>}
                    {feedback.type === "comments" && <div className="flex flex-col items-center"><MessageSquare className="w-12 h-12 text-white fill-white" /><span className="text-white font-black text-xs mt-1 uppercase">Comments</span></div>}
                    {feedback.type === "exit" && <div className="flex flex-col items-center"><LogOut className="w-12 h-12 text-white fill-white" /><span className="text-white font-black text-xs mt-1">EXIT</span></div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {timeLeft !== null && !watchEnded && timeLeft < 86400 && (
        <div className="absolute top-6 right-6 z-[60] animate-in fade-in slide-in-from-right-4 duration-500">
           <div className={`flex items-center space-x-2 px-4 py-2 backdrop-blur-md border rounded-full shadow-2xl transition-colors duration-500 ${
             timeLeft < 60 
               ? "bg-red-500/20 border-red-500/50 text-red-500" 
               : "bg-black/40 border-white/20 text-white"
           }`}>
              <Clock className={`w-4 h-4 ${timeLeft < 60 ? "animate-pulse" : ""}`} />
              <span className="text-xs font-black tabular-nums tracking-widest">
                 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} 
              </span>
           </div>
        </div>
      )}

      {/* Quality Badge Overlay */}
      <div className="absolute top-6 left-6 z-[60] flex items-center gap-2">
         {user?.plan?.toUpperCase() === "GOLD" && (
            <div className="bg-yellow-500 text-black text-[9px] font-black italic px-4 py-1.5 rounded-full shadow-2xl border border-yellow-400/50 uppercase tracking-widest animate-in slide-in-from-left-4">
              ✨ Cinematic 4K
            </div>
         )}
         {user?.plan?.toUpperCase() === "SILVER" && (
            <div className="bg-white text-black text-[9px] font-black italic px-4 py-1.5 rounded-full shadow-2xl border border-white/50 uppercase tracking-widest animate-in slide-in-from-left-4">
              🛡 Full HD
            </div>
         )}
         {user?.plan?.toUpperCase() === "BRONZE" && (
            <div className="bg-zinc-800 text-zinc-300 text-[9px] font-black italic px-4 py-1.5 rounded-full shadow-2xl border border-white/10 uppercase tracking-widest animate-in slide-in-from-left-4">
              ⚡ HD+
            </div>
         )}
      </div>

      {watchEnded && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-4 rounded-2xl animate-in slide-in-from-top-2">
          <p className="text-sm font-bold text-red-600 dark:text-red-400 text-center uppercase tracking-widest">
            Watch limit reached. Upgrade to continue.
          </p>
        </div>
      )}

      {isExiting && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 text-white p-6 text-center">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative bg-zinc-900 p-8 rounded-full border border-white/10 shadow-2xl">
                    <LogOut className="w-16 h-16 text-white animate-out slide-out-to-right-10 duration-1000 repeat-infinite" />
                </div>
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                Closing Session
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />
            <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase text-xs">
                Your connection is being terminated safely
            </p>
        </div>
      )}
    </div>
  );
}
