import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import GestureVideoPlayer from "@/components/GestureVideoPlayer";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";

const WatchVideoPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const commentRef = useRef<HTMLDivElement>(null);
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [relatedVideos, setRelatedVideos] = useState<any>(null);
  const [loading, setloading] = useState(true);

  useEffect(() => {
    const fetchvideo = async () => {
      if (!id || typeof id !== "string") return;
      try {
        const res = await axiosInstance.get("/video/getall");
        const allVideos = Array.isArray(res.data) ? res.data : [];
        const selectedVideo = allVideos.find((vid: any) => vid._id === id);

        if (selectedVideo) {
          setCurrentVideo(selectedVideo);
          setRelatedVideos(allVideos);
        } else {
          const sampleSelected = sampleYoutubeVideos.find((vid) => vid._id === id);
          if (sampleSelected) {
            setCurrentVideo(sampleSelected);
            setRelatedVideos(sampleYoutubeVideos);
          }
        }
      } catch (error) {
        const sampleSelected = sampleYoutubeVideos.find((vid) => vid._id === id);
        if (sampleSelected) {
          setCurrentVideo(sampleSelected);
          setRelatedVideos(sampleYoutubeVideos);
        }
      } finally {
        setloading(false);
      }
    };
    fetchvideo();
  }, [id]);

  useEffect(() => {
    const logHistory = async () => {
      if (!user?._id || !id || !currentVideo) {
        console.warn("DEBUG: History logging skipped - missing context:", { hasUser: !!user?._id, hasId: !!id, hasVideo: !!currentVideo });
        return;
      }

      try {
        await axiosInstance.post(`/history/handlehistory/${id}`, { userId: user._id });
        console.log("DEBUG: History successfully synchronized for video:", id);
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.error("DEBUG: History service unreachable (404). Check backend route configuration.");
        } else {
          console.error("DEBUG: History log failure:", error.message);
        }
      }
    };
    
    if (currentVideo) {
      logHistory();
    }
  }, [id, user?._id, currentVideo]);

  if (loading) {
    return <div>Loading..</div>;
  }

  if (!currentVideo) {
    return <div>Video not found</div>;
  }

  const handleNextVideo = () => {
    if (!relatedVideos || !Array.isArray(relatedVideos)) return;
    const currentIndex = relatedVideos.findIndex((entry: any) => entry._id === currentVideo._id);
    const next = relatedVideos[(currentIndex + 1) % relatedVideos.length];
    if (next?._id) {
      router.push(`/watch/${next._id}`);
    }
  };

  const handleOpenComments = () => {
    document.getElementById("comments-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleStartVideoCall = () => {
    if (!currentVideo?._id) return;
    const roomSeed = `watch-${currentVideo._id}`;
    router.push({
      pathname: "/calls",
      query: {
        room: roomSeed,
        video: currentVideo._id,
        title: currentVideo.videotitle,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-black w-full">
      <div className="w-full h-full p-2 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <GestureVideoPlayer
              video={currentVideo}
              allVideos={relatedVideos}
              onOpenComments={handleOpenComments}
              onStartVideoCall={handleStartVideoCall}
            />
            <VideoInfo video={currentVideo} />
            <div ref={commentRef}>
              <Comments videoId={id as string} />
            </div>
          </div>
          <div className="space-y-4">
            <RelatedVideos videos={relatedVideos.filter((v: any) => v._id !== id)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchVideoPage;
