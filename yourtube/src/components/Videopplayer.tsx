"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const DOUBLE_TAP_MS = 320;
const TRIPLE_TAP_MS = 540;

const getZone = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): Zone => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const third = rect.width / 3;
  if (x < third) return "left";
  if (x > third * 2) return "right";
  return "center";
};

export default function VideoPlayer({
  video,
  maxWatchMinutes,
  onNext,
  onOpenComments,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tapCount, setTapCount] = useState(0);
  const [lastZone, setLastZone] = useState<Zone | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [watchEnded, setWatchEnded] = useState(false);

  const watchLimitSeconds = useMemo(() => {
    if (maxWatchMinutes === null || maxWatchMinutes === undefined) return null;
    return maxWatchMinutes * 60;
  }, [maxWatchMinutes]);

  const executeAction = (count: number, zone: Zone) => {
    if (!videoRef.current && !["center", "left", "right"].includes(zone)) return;

    if (count === 1 && zone === "center" && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => null);
      } else {
        videoRef.current.pause();
      }
    } else if (count === 2 && videoRef.current) {
      if (zone === "left") {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      } else if (zone === "right") {
        videoRef.current.currentTime = Math.min(
          videoRef.current.duration || Infinity,
          videoRef.current.currentTime + 10
        );
      }
    } else if (count === 3) {
      if (zone === "center") onNext?.();
      else if (zone === "left") onOpenComments?.();
      else if (zone === "right") {
        const leave = window.confirm("Three-tap detected: Do you want to close the video and exit?");
        if (leave) {
          window.location.href = "/";
          window.close();
        }
      }
    }
  };

  const processTap = (zone: Zone) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    let newCount = tapCount + 1;
    if (zone !== lastZone) {
      newCount = 1;
    }

    setLastZone(zone);

    if (newCount === 3) {
      executeAction(3, zone);
      setTapCount(0);
      setLastZone(null);
    } else {
      setTapCount(newCount);
      timerRef.current = setTimeout(() => {
        executeAction(newCount, zone);
        setTapCount(0);
        setLastZone(null);
      }, DOUBLE_TAP_MS);
    }
  };

  useEffect(() => {
    const element = videoRef.current;
    if (!element || watchLimitSeconds === null) return;

    const onTimeUpdate = () => {
      if (element.currentTime >= watchLimitSeconds) {
        element.pause();
        setWatchEnded(true);
      }
    };

    element.addEventListener("timeupdate", onTimeUpdate);
    return () => element.removeEventListener("timeupdate", onTimeUpdate);
  }, [watchLimitSeconds, video._id]);

  useEffect(() => {
    setWatchEnded(false);
  }, [video._id, watchLimitSeconds]);

  const source =
    video?.filepath?.startsWith("video/") || video?.filepath?.startsWith("/video/")
      ? `/${video.filepath.replace(/^\/+/, "")}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/${video?.filepath}`;

  const isYoutubeSample = Boolean(video?.youtubeId);

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-video bg-black rounded-lg overflow-hidden"
        onClick={(event) => !isYoutubeSample && processTap(getZone(event))}
      >
        {isYoutubeSample ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}`}
            title={video.videotitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <video
            key={video._id}
            ref={videoRef}
            className="w-full h-full"
            controls
            poster={`/placeholder.svg?height=480&width=854`}
          >
            <source src={source} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {watchEnded && (
        <p className="text-sm text-red-500">
          Watch time limit reached for your plan. Upgrade to continue watching.
        </p>
      )}
    </div>
  );
}
