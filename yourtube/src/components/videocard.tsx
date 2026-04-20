"use client";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { safeNumber, safeTimeAgo } from "@/lib/date";

export default function VideoCard({ video }: any) {
  const isYoutubeSample = Boolean(video?.youtubeId && video.youtubeId !== "undefined");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";
  
  const thumbnailSrc = video?.thumbnailPath 
    ? `${backendUrl}/${video.thumbnailPath.replace(/^\/+/, "")}`
    : null;

  const videoSrc = (isYoutubeSample && video?.youtubeId)
    ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`
    : video?.filepath?.startsWith("video/") || video?.filepath?.startsWith("/video/")
    ? `/${video.filepath.replace(/^\/+/, "")}`
    : `${backendUrl}/${video?.filepath}`;

  return (
    <Link href={`/watch/${video?._id}`} className="group">
      <div className="space-y-3">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-xl border border-black/5 dark:border-white/5">
          {isYoutubeSample || thumbnailSrc ? (
            <img
              src={thumbnailSrc || videoSrc}
              alt={video?.videotitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80"; // Premium abstract placeholder
              }}
            />
          ) : (
            <video
              src={videoSrc}
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
          )}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">
            {isYoutubeSample ? "YouTube" : "10:24"}
          </div>
        </div>
        <div className="flex gap-3">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarImage src={video.uploader?.image} />
            <AvatarFallback>{video.videochanel?.[0] || video.uploader?.name?.[0] || "Y"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600">
              {video?.videotitle}
            </h3>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1 truncate">{video?.videochanel || "YouTube"}</p>
            <p className="text-xs text-zinc-500 font-medium">
              {safeNumber(video?.views).toLocaleString()} views • {safeTimeAgo(video?.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
