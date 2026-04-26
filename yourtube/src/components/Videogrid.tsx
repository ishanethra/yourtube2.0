import React, { useEffect, useMemo, useState } from "react";
import Videocard from "./videocard";
import axiosInstance from "@/lib/axiosinstance";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { Skeleton } from "./ui/skeleton";
import AdCard from "./AdCard";
import { useUser } from "@/lib/AuthContext";


const VideoSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="aspect-video w-full rounded-xl" />
    <div className="flex gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-3 w-[60%]" />
      </div>
    </div>
  </div>
);

const Videogrid = ({ activeCategory = "All" }: { activeCategory?: string }) => {
  const [videos, setvideo] = useState<any>(null);
  const [loading, setloading] = useState(true);

  useEffect(() => {
    const fetchvideo = async () => {
      try {
        const res = await axiosInstance.get("/video/getall");
        setvideo(res.data);
      } catch (error) {
        console.error("Failed to load feed videos", error);
      } finally {
        setloading(false);
      }
    };
    fetchvideo();
  }, []);

  const dynamicFeed = Array.isArray(videos) ? videos : [];
  
  // Filter out unwanted placeholders and seed videos
  const titlesToRemove = [
    "Advanced Next.js Tutorial",
    "Modern UI/UX Design Trends",
    "WebRTC End-to-End Guide",
    "QA Seed Video"
  ];

  const filteredDynamicFeed = dynamicFeed.filter(
    (video: any) => !titlesToRemove.includes(video?.videotitle)
  );

  const hasValidSource = (video: any) => {
    if (!video) return false;
    const yt = String(video.youtubeId || "").trim();
    const validYouTube = yt ? /^[a-zA-Z0-9_-]{11}$/.test(yt) : false;
    const hasFilePath = Boolean(String(video.filepath || "").trim());
    return validYouTube || hasFilePath;
  };

  const allFeed = useMemo(
    () => [...filteredDynamicFeed, ...sampleYoutubeVideos].filter(hasValidSource),
    [filteredDynamicFeed]
  );

  const feed = useMemo(
    () => activeCategory === "All"
      ? allFeed
      : allFeed.filter((video: any) => video?.category === activeCategory),
    [activeCategory, allFeed]
  );

  const { user } = useUser();
  const showAds = !user || (user.plan || "FREE").toUpperCase() === "FREE";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-12">
      {loading ? (
        Array.from({ length: 8 }).map((_, i) => <VideoSkeleton key={i} />)
      ) : (
        feed.map((video: any, index: number) => (
          <React.Fragment key={video._id}>
            <Videocard video={video} />
            {showAds && (index + 1) % 4 === 0 && <AdCard />}
          </React.Fragment>
        ))
      )}
    </div>
  );
};


export default Videogrid;
