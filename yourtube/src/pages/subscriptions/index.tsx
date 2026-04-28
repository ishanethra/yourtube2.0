import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, PlaySquare, Users, Radio } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { safeTimeAgo, safeTimestamp } from "@/lib/date";
import { Button } from "@/components/ui/button";

type UserProfile = {
  _id: string;
  channelname?: string;
  name?: string;
  image?: string;
  subscribers?: string[];
};

type VideoType = {
  _id: string;
  videotitle: string;
  videochanel?: string;
  filepath?: string;
  youtubeId?: string;
  views?: number;
  createdAt?: string;
  uploader?: any;
};

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const isObjectId = (value: string) => objectIdRegex.test(value);

export default function SubscriptionsPage() {
  const { user, handlegooglesignin } = useUser();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [channelMap, setChannelMap] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const load = async () => {
      if (!user?._id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [freshUserRes, videosRes] = await Promise.all([
          axiosInstance.get(`/user/${user._id}`),
          axiosInstance.get("/video/getall"),
        ]);

        const freshUser = freshUserRes.data || {};
        const subscribedChannels: string[] = Array.isArray(freshUser.subscribedChannels)
          ? freshUser.subscribedChannels
          : [];

        setSubscriptions(subscribedChannels);
        setVideos(Array.isArray(videosRes.data) ? videosRes.data : []);

        const objectIdSubscriptions = subscribedChannels.filter(isObjectId);
        if (objectIdSubscriptions.length > 0) {
          const channelResponses = await Promise.all(
            objectIdSubscriptions.map((id) => axiosInstance.get(`/user/${id}`).catch(() => null))
          );
          const map: Record<string, UserProfile> = {};
          channelResponses.forEach((res) => {
            const data = res?.data;
            if (data?._id) map[data._id] = data;
          });
          setChannelMap(map);
        } else {
          setChannelMap({});
        }
      } catch (error) {
        console.error("Failed to load subscriptions:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?._id]);

  const feedVideos = useMemo(() => {
    if (!subscriptions.length) return [];
    const subscribedSet = new Set(subscriptions);

    const fromUploaded = videos.filter((video) => {
      const uploaderId = video?.uploader?._id || video?.uploader;
      if (typeof uploaderId === "string" && subscribedSet.has(uploaderId)) return true;
      return false;
    });

    const sampleByChannel = sampleYoutubeVideos.filter((video: any) => {
      const channelKey = video?.channelId || video?.videochanel;
      return typeof channelKey === "string" && subscribedSet.has(channelKey);
    });

    const merged = [...fromUploaded, ...sampleByChannel];
    const dedupMap: Record<string, VideoType> = {};
    merged.forEach((video) => {
      dedupMap[video._id] = video;
    });

    return Object.values(dedupMap).sort((a, b) => {
      const ta = safeTimestamp(a.createdAt);
      const tb = safeTimestamp(b.createdAt);
      return tb - ta;
    });
  }, [subscriptions, videos]);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="p-6 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <PlaySquare className="w-14 h-14 text-zinc-400" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Your Subscriptions</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Sign in to view subscribed channels and their latest videos.
          </p>
        </div>
        <Button onClick={handlegooglesignin} className="rounded-full px-8 h-11">
          Sign in
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-56 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
              <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
              <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!subscriptions.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-6">
        <div className="p-6 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <BellOff className="w-16 h-16 text-zinc-400" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">No Subscriptions Yet</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Subscribe to channels and they will appear here instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Your Subscriptions</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {subscriptions.length} channels · {feedVideos.length} videos
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {subscriptions.map((id) => {
          const channel = channelMap[id];
          const label = channel?.channelname || channel?.name || (isObjectId(id) ? `Channel ${id.slice(-4)}` : id);
          const subs = channel?.subscribers?.length;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-xs font-bold"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              {label}
              {typeof subs === "number" ? (
                <span className="text-zinc-500">{subs.toLocaleString()}</span>
              ) : null}
            </span>
          );
        })}
      </div>

      {feedVideos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500">
          Subscribed channels found, but no videos are available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {feedVideos.map((video) => {
            const thumb = video.youtubeId
              ? `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`
              : video.filepath
              ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/${video.filepath}`
              : "";
            return (
              <Link
                key={video._id}
                href={`/watch/${video._id}`}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                  {thumb ? (
                    // We intentionally use img here to avoid Next Image domain config overhead.
                    <img
                      src={thumb}
                      alt={video.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <Radio className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <h3 className="mt-3 font-bold line-clamp-2 text-zinc-900 dark:text-zinc-100">
                  {video.videotitle}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {video.videochanel || "Channel"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {(video.views || 0).toLocaleString()} views
                  {video.createdAt ? ` · ${safeTimeAgo(video.createdAt)}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
