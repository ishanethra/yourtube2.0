import Link from "next/link";
import { safeNumber, safeTimeAgo } from "@/lib/date";
import AdCard from "./AdCard";
import { useUser } from "@/lib/AuthContext";

interface RelatedVideosProps {
  videos: Array<{
    _id: string;
    videotitle: string;
    videochanel: string;
    views: number;
    createdAt: string;
    youtubeId?: string;
  }>;
}

export default function RelatedVideos({ videos }: RelatedVideosProps) {
  const { user } = useUser();
  const showAds = !user || (user.plan || "FREE").toUpperCase() === "FREE";

  return (
    <div className="space-y-4">
      {showAds && (
        <div className="mb-4 transform scale-95 opacity-80 hover:opacity-100 transition-opacity">
           <AdCard />
        </div>
      )}
      <div className="space-y-2">
      {Array.isArray(videos) && videos.map((video) => (
        <Link
          key={video._id}
          href={`/watch/${video._id}`}
          className="flex gap-2 group"
        >
          <div className="relative w-40 aspect-video bg-gray-100 rounded overflow-hidden flex-shrink-0">
            {video.youtubeId ? (
              <img
                src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                alt={video.videotitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80"; // Premium abstract placeholder
                }}
              />
            ) : (
              <video
                src="/video/vdo.mp4"
                className="object-cover group-hover:scale-105 transition-transform duration-200"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600">
              {video.videotitle}
            </h3>
            <p className="text-xs text-gray-600 mt-1">{video.videochanel}</p>
            <p className="text-xs text-gray-600">
              {safeNumber(video.views).toLocaleString()} views • {safeTimeAgo(video.createdAt)}
            </p>
          </div>
        </Link>
      ))}
      </div>
    </div>
  );
}
