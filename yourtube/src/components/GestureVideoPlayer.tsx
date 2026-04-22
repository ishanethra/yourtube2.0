import { useRef, useEffect, useState, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}
import { useUser } from "@/lib/AuthContext";
import { Button } from "./ui/button";
import { Crown, LogIn, SkipForward, SkipBack, Play, Pause, MessageSquare, X, Youtube } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";
import { toast } from "sonner";
import VideoPlayer from "./Videopplayer";

interface GestureVideoPlayerProps {
  video: { _id: string; videotitle: string; filepath: string; youtubeId?: string };
  allVideos?: any[];
  onOpenComments?: () => void;
  onStartVideoCall?: () => void;
}

// Ripple animation for gesture feedback
const GestureRipple = ({ side, count }: { side: string; count: number }) => {
  const icons: Record<string, string> = {
    "left-double": "« -10s",
    "left-triple": "💬 Comments",
    "center-single": "⏯",
    "center-triple": "⏭ Next",
    "right-double": "+10s »",
    "right-triple": "✕ Close",
  };
  const label = icons[`${side}-${count === 1 ? "single" : count === 2 ? "double" : "triple"}`] || "";
  if (!label) return null;
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none z-30 animate-in fade-in zoom-in-50 duration-200 ${
      side === "left" ? "left-8" : side === "right" ? "right-8" : "left-1/2 -translate-x-1/2"
    }`}>
      <div className="bg-black/70 text-white font-black text-lg px-5 py-3 rounded-2xl backdrop-blur-md shadow-2xl border border-white/10">
        {label}
      </div>
    </div>
  );
};

export default function GestureVideoPlayer({ video, allVideos = [], onOpenComments, onStartVideoCall }: GestureVideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tapCountRef = useRef<number>(0);
  const lastTapSide = useRef<string>("");
  const { user, handlegooglesignin } = useUser();
  const [limitReached, setLimitReached] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(user?.plan || "Free");
  const [isGuest, setIsGuest] = useState(!user);
  const [countdown, setCountdown] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const router = useRouter();

  const callPlayer = (method: string, ...args: any[]) => {
    if (playerRef.current && typeof playerRef.current[method] === 'function') {
      try {
        return playerRef.current[method](...args);
      } catch (e) {
        console.warn(`[Player] Failed to call ${method}:`, e);
      }
    }
    return null;
  };

  const isYouTube = !!video.youtubeId || (!!video.filepath && !video.filepath.includes('/') && !video.filepath.includes('.'));
  
  // Normalize the video ID/Path for YT player
  const ytVideoId = video.youtubeId || (video.filepath && !video.filepath.includes('/') && !video.filepath.includes('.') ? video.filepath : video.filepath?.split('/').pop()?.split('?')[0]);

  // Initialize YouTube Player API
  useEffect(() => {
    if (!isYouTube || !ytVideoId) {
      setPlayerLoaded(false);
      return;
    }
    const videoId = ytVideoId;
    if (!videoId) return;

    const initPlayer = () => {
      // If player already exists, just load the new video
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById(videoId);
          return;
        } catch (e) {
          console.error("Player load error, re-initializing:", e);
        }
      }

      const container = document.getElementById(`youtube-player-container`);
      if (!container) return;

      try {
        playerRef.current = new window.YT.Player(container, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            autohide: 1,
            enablejsapi: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: () => setPlayerLoaded(true),
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PAUSED) setIsPaused(true);
              if (event.data === window.YT.PlayerState.PLAYING) setIsPaused(false);
            },
          },
        });
      } catch (e) {
        console.error("YT Player init crash:", e);
      }
    };

    if (!window.YT || !window.YT.Player) {
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
      
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousCallback) previousCallback();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      // Aggressive cleanup to prevent background music leaks
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.pauseVideo === 'function') playerRef.current.pauseVideo();
          if (typeof playerRef.current.mute === 'function') playerRef.current.mute();
          if (typeof playerRef.current.destroy === 'function') playerRef.current.destroy();
        } catch (e) { console.warn("Cleanup error:", e); }
        playerRef.current = null;
      }
    };
  }, [video?.filepath, video?._id, isYouTube]);

  // Gesture feedback
  const [gestureHint,     setGestureHint]     = useState<{ side: string; count: number } | null>(null);
  const gestureTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showHint = (side: string, count: number) => {
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    setGestureHint({ side, count });
    gestureTimerRef.current = setTimeout(() => setGestureHint(null), 800);
  };

  // ── Watch-time tracking ──────────────────────────────────────────────────
  useEffect(() => {
    const checkInitialLimit = async () => {
      if (!user || user.plan === "GOLD") return;
      try {
        const res = await axiosInstance.post("/user/watch-time/update", { userId: user._id, incrementSeconds: 0 });
        if (res.data.remainingSeconds <= 0) {
          setLimitReached(true);
          setCurrentPlan(user.plan || "Free");
        }
      } catch (e) { console.error("Initial limit check error:", e); }
    };
    checkInitialLimit();
  }, [user]);

  useEffect(() => {
    if (limitReached) return;
    const interval = setInterval(async () => {
      if (!playerRef.current || isPaused) return;
      
      if (user) {
        if (user.plan === "GOLD") return; // Unlimited access
        try {
          const res = await axiosInstance.post("/user/watch-time/update", { userId: user._id, incrementSeconds: 10 });
          if (res.data.remainingSeconds <= 0) { 
            callPlayer('pauseVideo');
            setLimitReached(true); 
            setCurrentPlan(user.plan || "Free"); 
            setIsGuest(false); 
          }
        } catch { /* ignore */ }
      } else {
        if (typeof window !== "undefined" && window.localStorage) {
          const stored = parseInt(localStorage.getItem("guestWatchTime") || "0");
          const next = stored + 10;
          localStorage.setItem("guestWatchTime", String(next));
          if (next >= 300) { 
            callPlayer('pauseVideo');
            setLimitReached(true); 
            setIsGuest(true); 
          }
        }
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [user, limitReached, isPaused]);

  // ── YouTube Sync (v2.0 Collaborative Watch) ───────────────────────────────
  useEffect(() => {
    const handleReceiveSync = (e: any) => {
      const { action, time } = e.detail;
      
      const currentTime = callPlayer('getCurrentTime');
      if (currentTime !== null && Math.abs(currentTime - time) > 2) {
        callPlayer('seekTo', time, true);
      }

      if (action === "play") callPlayer('playVideo');
      else if (action === "pause") callPlayer('pauseVideo');
    };

    window.addEventListener("youtube-sync-receive", handleReceiveSync);
    return () => window.removeEventListener("youtube-sync-receive", handleReceiveSync);
  }, []);

  const dispatchSync = (action: string) => {
    if (!playerLoaded) return;
    const time = callPlayer('getCurrentTime');
    if (time !== null) {
      window.dispatchEvent(new CustomEvent("youtube-sync-send", {
        detail: { action, time }
      }));
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (limitReached && user?.plan === "GOLD") {
      setLimitReached(false);
      if (playerLoaded) callPlayer('playVideo');
      return;
    }

    if (!limitReached) return;
    
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { 
          clearInterval(t); 
          callPlayer('pauseVideo'); // Explicitly pause before redirect
          router.push(`/premium?from=${encodeURIComponent(router.asPath)}`); 
          return 0; 
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [limitReached, user?.plan]);

  // ── Tap gesture handler ──────────────────────────────────────────────────
  const handleTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    e.preventDefault();
    e.stopPropagation();

    const clientX = Number.isFinite(e.clientX) ? e.clientX : rect.left + rect.width / 2;

    const relX = clientX - rect.left;
    const third = rect.width / 3;

    const side = relX < third ? "left" : relX > third * 2 ? "right" : "center";

    tapCountRef.current += 1;
    lastTapSide.current = side;

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    tapTimerRef.current = setTimeout(() => {
      const count = tapCountRef.current;
      const s = lastTapSide.current;
      tapCountRef.current = 0;
      executeGesture(s, count);
      showHint(s, count);
    }, 280);
  }, []);

  const executeGesture = (side: string, count: number) => {
    if (!playerRef.current) return;

    if (side === "left") {
      if (count === 2) {
        const current = callPlayer('getCurrentTime');
        if (current !== null) callPlayer('seekTo', Math.max(0, current - 10), true);
        toast("⏪ -10 seconds");
      } else if (count >= 3) {
        if (onOpenComments) {
          if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
              // Longer delay to ensure DOM layout settles for scrollIntoView
              setTimeout(() => {
                onOpenComments();
                // Fallback scroll if onOpenComments fails
                document.getElementById("comments-section")?.scrollIntoView({ behavior: "smooth" });
              }, 300);
            }).catch(() => onOpenComments());
          } else {
            onOpenComments();
          }
          toast("💬 Comments opened");
        }
      }
    } else if (side === "center") {
      if (count === 1) {
        const state = callPlayer('getPlayerState');
        if (state === window.YT.PlayerState.PLAYING) {
          callPlayer('pauseVideo');
          dispatchSync("pause");
        } else {
          callPlayer('playVideo');
          dispatchSync("play");
        }
      } else if (count >= 3) {
        const currentIndex = allVideos.findIndex(v => v._id === video._id);
        if (currentIndex !== -1 && allVideos[currentIndex + 1]) {
          router.push(`/watch/${allVideos[currentIndex + 1]._id}`);
          toast("⏭ Next video");
        }
      }
    } else if (side === "right") {
      if (count === 2) {
        const current = callPlayer('getCurrentTime');
        if (current !== null) callPlayer('seekTo', current + 10, true);
        toast("⏩ +10 seconds");
      } else if (count >= 3) {
        if (confirm("Close website?")) {
           window.close();
           // Fallback for browsers that block script-initiated close
           setTimeout(() => router.push("/"), 500);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden group shadow-2xl" style={{ maxHeight: "calc(100vh - var(--header-height) - 150px)" }}>
      {/* Gesture zones — invisible overlay on top of video controls */}
      {isYouTube && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onPointerUp={handleTap}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent", userSelect: "none" }}
        >
          {/* Visual zone hints on hover */}
          <div className="absolute inset-y-0 left-0 w-1/3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="flex flex-col items-center gap-1">
              <SkipBack className="w-5 h-5 text-white/30" />
              <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">×2 Tap</span>
            </div>
          </div>
          <div className="absolute inset-y-0 left-1/3 right-1/3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="flex flex-col items-center gap-1">
              {isPaused ? <Play className="w-5 h-5 text-white/30" /> : <Pause className="w-5 h-5 text-white/30" />}
              <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest leading-none">Tap Play</span>
            </div>
          </div>
          <div className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="flex flex-col items-center gap-1">
              <SkipForward className="w-5 h-5 text-white/30" />
              <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">×2 Tap</span>
            </div>
          </div>
        </div>
      )}

      {onStartVideoCall && (
        <button
          type="button"
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStartVideoCall();
          }}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-40 inline-flex items-center gap-2 rounded-full bg-black/75 text-white border border-white/10 px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.2em] shadow-2xl backdrop-blur-md hover:bg-red-600 transition-colors active:scale-95"
        >
          <MessageSquare className="w-4 h-4" />
          Video Call
        </button>
      )}

      {/* Gesture feedback ripple */}
      {gestureHint && <GestureRipple side={gestureHint.side} count={gestureHint.count} />}

      {/* Actual Video Player Layer */}
      <div className="w-full h-full">
        {isYouTube ? (
          <>
            <div id="youtube-player-container" className="w-full h-full pointer-events-none" />
            {!playerLoaded && (
              <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                <Youtube className="w-12 h-12 text-red-600 animate-pulse" />
              </div>
            )}
          </>
        ) : (
          <VideoPlayer video={video} />
        )}
      </div>

      {/* Gesture legend */}
      <div className="absolute bottom-3 sm:bottom-14 left-0 right-0 flex justify-between px-3 sm:px-4 pointer-events-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 z-20">
        <div className="flex flex-col gap-0.5">
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×2 → -10s</span>
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×3 → Comments</span>
        </div>
        <div className="flex flex-col gap-0.5 items-center">
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×1 → Play/Pause</span>
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×3 → Next</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×2 → +10s</span>
          <span className="text-[7px] sm:text-[8px] text-white/40 font-bold">×3 → Close</span>
        </div>
      </div>

      {/* Limit overlay */}
      {limitReached && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-yellow-400/20 blur-2xl rounded-full" />
            <Crown className="w-16 h-16 text-yellow-400 relative animate-bounce" />
          </div>
          <h2 className="text-white text-3xl font-black mb-3 tracking-tight">
            {isGuest ? "Sign In to Continue!" : "Daily Limit Reached!"}
          </h2>
          <p className="text-gray-400 mb-8 max-w-sm font-medium leading-relaxed">
            {isGuest
              ? "Guests get a limited preview. Sign in to keep watching!"
              : `You've reached your ${currentPlan} plan limit. Redirecting to Premium in ${countdown}s…`}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
            {isGuest ? (
              <Button className="bg-red-600 hover:bg-red-700 h-12 rounded-full font-black flex items-center gap-2 grow" onClick={handlegooglesignin}>
                <LogIn className="w-5 h-5" /> SIGN IN NOW
              </Button>
            ) : (
              <Button className="bg-yellow-500 text-black hover:bg-yellow-400 h-12 rounded-full font-black flex items-center gap-2 grow" onClick={() => router.push(`/premium?from=${encodeURIComponent(router.asPath)}`)}>
                <Crown className="w-5 h-5 text-black" /> UPGRADE NOW
              </Button>
            )}
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12 rounded-full font-bold px-6" onClick={() => { callPlayer('seekTo', 0, true); setLimitReached(false); }}>
              PREVIEW AGAIN
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
