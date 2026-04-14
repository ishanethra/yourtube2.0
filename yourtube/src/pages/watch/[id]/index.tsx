import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import Videopplayer from "@/components/Videopplayer";
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
  const [sampleComment, setSampleComment] = useState("");
  const [sampleComments, setSampleComments] = useState<string[]>([
    "Great sample video",
    "This feels like YouTube now",
  ]);

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

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Videopplayer
              video={currentVideo}
              maxWatchMinutes={currentVideo?.youtubeId ? null : user?.watchLimitMinutes}
              onNext={handleNextVideo}
              onOpenComments={handleOpenComments}
            />
            <VideoInfo video={currentVideo} />
            <div ref={commentRef}>
              {currentVideo?.youtubeId ? (
                <div id="comments-section" className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    {sampleComments.length} Comments
                  </h2>
                  <div className="flex gap-2">
                    <input
                      value={sampleComment}
                      onChange={(e) => setSampleComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="border rounded px-3 py-2 flex-1"
                    />
                    <button
                      className="px-3 py-2 rounded bg-black text-white"
                      onClick={() => {
                        if (!sampleComment.trim()) return;
                        setSampleComments((prev) => [sampleComment.trim(), ...prev]);
                        setSampleComment("");
                      }}
                    >
                      Comment
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sampleComments.map((text, idx) => (
                      <p key={`${text}-${idx}`} className="text-sm">
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <Comments videoId={id as string} />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <RelatedVideos videos={relatedVideos} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchVideoPage;
