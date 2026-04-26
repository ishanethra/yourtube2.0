import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";

const ChannelPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id || typeof id !== "string") return;
      setLoading(true);
      try {
        const [channelRes, allVideosRes] = await Promise.all([
          axiosInstance.get(`/user/${id}`),
          axiosInstance.get("/video/getall"),
        ]);
        const channelData = channelRes.data;
        const allVideos = Array.isArray(allVideosRes.data) ? allVideosRes.data : [];

        const channelVideos = allVideos.filter((video: any) => {
          const uploaderId =
            typeof video?.uploader === "string" ? video.uploader : video?.uploader?._id;
          return uploaderId && String(uploaderId) === String(id);
        });

        setChannel(channelData);
        setVideos(channelVideos);
      } catch (error) {
        // Fallback for sample/non-DB channels (string uploader ids / sample channel names).
        const sampleChannelVideos = sampleYoutubeVideos.filter((video: any) => {
          const uploaderId =
            typeof video?.uploader === "string" ? video.uploader : video?.uploader?._id;
          const channelName = video?.videochanel;
          return String(uploaderId || "") === String(id) || String(channelName || "") === String(id);
        });

        if (sampleChannelVideos.length > 0) {
          const sampleName =
            sampleChannelVideos[0]?.videochanel ||
            sampleChannelVideos[0]?.uploader?.name ||
            String(id);
          const sampleImage = sampleChannelVideos[0]?.uploader?.image || "";
          setChannel({
            _id: String(id),
            channelname: sampleName,
            name: sampleName,
            image: sampleImage,
            description: "",
          });
          setVideos(sampleChannelVideos);
        } else {
          console.error("Error fetching channel data:", error);
          setChannel(null);
          setVideos([]);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const isOwnChannel = useMemo(() => {
    if (!user?._id || !id || typeof id !== "string") return false;
    return String(user._id) === String(id);
  }, [user?._id, id]);

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-white dark:bg-black">
        <div className="px-4 py-10 text-zinc-500">Loading channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 min-h-screen bg-white dark:bg-black">
        <div className="px-4 py-10 text-zinc-500">Channel not found.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-white dark:bg-black">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} user={user} />
        <Channeltabs />
        {isOwnChannel && (
          <div className="px-4 pb-8">
            <VideoUploader channelId={id} channelName={channel?.channelname || channel?.name} />
          </div>
        )}
        <div className="px-4 pb-8">
          <ChannelVideos videos={videos} />
        </div>
      </div>
    </div>
  );
};

export default ChannelPage;
