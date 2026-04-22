import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Download,
  MoreHorizontal,
  Share,
  ThumbsDown,
  ThumbsUp,
  Scissors,
  Save,
  Check,
  Zap,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Globe,
  Trash2,
  Crown
} from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { safeTimeAgo } from "@/lib/date";

const VideoInfo = ({ video }: any) => {
  const router = useRouter();
  const { user, handlegooglesignin } = useUser();
  const [likes, setlikes] = useState(video.Like || 0);
  const [dislikes, setDislikes] = useState(video.Dislike || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localSubCount, setLocalSubCount] = useState(0);

  useEffect(() => {
    // Attempt to parse sub count from the uploader object if it exists
    if (video.uploader?.subscribers) {
       setLocalSubCount(video.uploader.subscribers.length);
    } else {
       // Placeholder if no data available, but typically handled by fetchStatus
       setLocalSubCount(1200000); 
    }
  }, [video.uploader]);

  const handleDownload = async () => {
    if (!user) return handlegooglesignin();
    setIsDownloading(true);
    try {
      // This single endpoint handles: duplicate check, daily limit check, and recording
      const res = await axiosInstance.post(`/video/download/${video._id}`, {
        userId: user._id,
      });

      if (res.data.alreadyExists) {
        toast.info(res.data.message || "This video is already in your downloads.");
        return;
      }

      toast.success(res.data.message || "Saved to your Downloads library!");
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error(error.response.data.message || "Free users can save only 1 video per day. Upgrade to Premium!");
        // v2.0 Pause command to ensure clean navigation
        window.dispatchEvent(new CustomEvent("youtube-sync-receive", { detail: { action: "pause", time: 0 } }));
        router.push(`/premium?from=${encodeURIComponent(router.asPath)}`);
      } else {
        toast.error("Download unavailable for this video.");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    setlikes(video.Like || 0);
    setDislikes(video.Dislike || 0);
  }, [video]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (user && video?._id) {
        try {
          const res = await axiosInstance.get(`/like/status/${video._id}/${user._id}`);
          setIsLiked(res.data.isLiked);
          setIsDisliked(res.data.isDisliked);
          setlikes(res.data.totalLikes);
          setDislikes(res.data.totalDislikes);
          const wlRes = await axiosInstance.get(`/watch/status/${video._id}/${user._id}`);
          setIsWatchLater(wlRes.data.saved);
          const targetChannelId = video.uploader?._id || video.uploader;
          if (targetChannelId) {
            const subRes = await axiosInstance.get(`/user/subscription-status/${targetChannelId}/${user._id}`);
            setIsSubscribed(subRes.data.subscribed);
            if (subRes.data.subscribersCount !== undefined) {
               setLocalSubCount(subRes.data.subscribersCount);
            }
          }
        } catch (error: any) {
          console.error("fetchStatus error", error);
        }
      }
    };
    fetchStatus();
  }, [user, video?._id]);

  const handleLike = async () => {
    if (!user) return handlegooglesignin();
    try {
      const res = await axiosInstance.post(`/like/like/${video._id}`, { userId: user?._id });
      if (res.status === 200) {
        if (isLiked) {
          setlikes((prev: any) => prev - 1);
          setIsLiked(false);
        } else {
          setlikes((prev: any) => prev + 1);
          setIsLiked(true);
          if (isDisliked) {
            setDislikes((prev: any) => prev - 1);
            setIsDisliked(false);
          }
        }
      }
    } catch (error) { console.log(error); }
  };

  const handleDislike = async () => {
    if (!user) return handlegooglesignin();
    try {
      const res = await axiosInstance.post(`/like/dislike/${video._id}`, { userId: user?._id });
      if (res.status === 200) {
        if (isDisliked) {
          setDislikes((prev: any) => prev - 1);
          setIsDisliked(false);
        } else {
          setDislikes((prev: any) => prev + 1);
          setIsDisliked(true);
          if (isLiked) {
            setlikes((prev: any) => prev - 1);
            setIsLiked(false);
          }
        }
      }
    } catch (error) { console.log(error); }
  };

  const handleWatchLater = async () => {
    if (!user) return handlegooglesignin();
    try {
      if (isWatchLater) {
        await axiosInstance.delete(`/watch/remove/${video._id}/${user._id}`);
        setIsWatchLater(false);
        toast.success("Removed from Watch Later");
      } else {
        await axiosInstance.post(`/watch/add`, { videoid: video._id, userid: user?._id });
        setIsWatchLater(true);
        toast.success("Added to Watch Later");
      }
    } catch (error) { toast.error("Failed to update Watch Later."); }
  };

  const handleSubscribe = async () => {
    if (!user) return handlegooglesignin();
    const targetChannelId = video.uploader?._id || video.uploader || video.videochanel || "sample-channel";
    if (!targetChannelId) {
      toast.error("Channel identification failed. Primary metadata missing.");
      return;
    }

    // Optimistic state
    const previousStatus = isSubscribed;
    setIsSubscribed(!previousStatus);
    setLocalSubCount(prev => !previousStatus ? prev + 1 : Math.max(0, prev - 1));

    try {
      let res;
      if (!previousStatus) {
        // Subscribe: Endpoint supports both body and param, using param for consistency
        res = await axiosInstance.post(`/user/subscribe/${targetChannelId}`, { userId: user._id });
        toast.success(`Subscribed to ${video.uploader?.name || video.videochanel || 'Channel'}`);
      } else {
        // Unsubscribe
        res = await axiosInstance.post(`/user/unsubscribe/${targetChannelId}`, { userId: user._id });
        toast.success(`Unsubscribed from ${video.uploader?.name || video.videochanel || 'Channel'}`);
      }

      // Sync with server result if available
      if (res.data.subscribed !== undefined) {
        setIsSubscribed(res.data.subscribed);
      }
      if (res.data.subscribersCount !== undefined) {
        setLocalSubCount(res.data.subscribersCount);
      }
    } catch (error) {
      // Rollback on failure
      setIsSubscribed(previousStatus);
      setLocalSubCount(prev => previousStatus ? prev : Math.max(0, prev - 1));
      console.error("Subscription Error:", error);
      toast.error("Couldn't update subscription");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
    try {
      await axiosInstance.delete(`/video/delete/${video._id}`, {
        data: { userId: user?._id }
      });
      toast.success("Video deleted successfully");
      router.push("/");
    } catch (error) {
      toast.error("Failed to delete video.");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch (err) { console.error("Failed to copy link", err); }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="space-y-3">
         <h1 className="text-3xl md:text-5xl font-bold text-black dark:text-white tracking-tight leading-tight">
           {video.videotitle}
         </h1>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="flex items-center gap-6 group">
          <div className="relative cursor-pointer">
            <Avatar className="w-16 h-16 ring-1 ring-black/5 dark:ring-white/10 group-hover:ring-zinc-400 dark:group-hover:ring-zinc-500 transition-all duration-700 overflow-hidden shadow-3xl bg-zinc-100 dark:bg-black rounded-2xl scale-100 group-hover:scale-110">
              <AvatarImage src={video.uploader?.image} className="object-cover" />
              <AvatarFallback className="bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white font-black italic text-xl">{video.videochanel?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-zinc-800 p-1 rounded-lg shadow-2xl border-2 border-black">
              <ShieldCheck className="w-3 h-3 text-white" />
            </div>
          </div>
          
          <div className="flex flex-col min-w-0 pr-4">
            <h2 className="text-xl font-black uppercase tracking-tighter text-black dark:text-white truncate">
              {video.videochanel || video.uploader?.name || "YouTube"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">
                 {video.uploader?.plan || "FREE"} MEMBER
               </p>
               <span className="text-zinc-800">•</span>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">
                 {localSubCount.toLocaleString()} Subscribers
               </p>
            </div>
          </div>

          <Button
            className={`rounded-2xl font-black px-10 h-14 text-[10px] uppercase tracking-[0.3em] transition-all duration-700 shadow-3xl italic hidden sm:flex ${
              isSubscribed 
                ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white" 
                : "bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 scale-100 hover:scale-105 active:scale-95"
            }`}
            onClick={handleSubscribe}
          >
            {isSubscribed ? "Subscribed" : "Subscribe"}
          </Button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-4 xl:pb-0 no-scrollbar">
          <div className="flex items-center bg-zinc-100 dark:bg-white/[0.03] backdrop-blur-3xl border border-zinc-200 dark:border-white/10 rounded-3xl h-14 p-1.5 shadow-3xl group/votes">
            <button
              className={`flex items-center gap-3 px-8 h-full rounded-2xl transition-all duration-500 ${isLiked ? "bg-black dark:bg-white text-white dark:text-black shadow-2xl scale-105" : "hover:bg-zinc-200 dark:hover:bg-white/5 text-zinc-400 hover:text-black dark:hover:text-white"}`}
              onClick={handleLike}
            >
              <ThumbsUp className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-[11px] font-black tracking-widest uppercase italic">{likes.toLocaleString()}</span>
            </button>
            <div className="w-[1px] h-6 bg-black/10 dark:bg-white/5 mx-1" />
            <button
              className={`flex items-center gap-3 px-6 h-full rounded-2xl transition-all duration-500 ${isDisliked ? "bg-zinc-200 text-black shadow-2xl scale-105" : "hover:bg-zinc-200 dark:hover:bg-white/5 text-zinc-400 hover:text-black dark:hover:text-white"}`}
              onClick={handleDislike}
            >
              <ThumbsDown className={`w-4 h-4 ${isDisliked ? "fill-current" : ""}`} />
              <span className="text-[11px] font-black tracking-widest uppercase italic">{dislikes.toLocaleString()}</span>
            </button>
          </div>

          {[
            { icon: <Share className="w-4 h-4" />, label: "Share", action: handleShare },
            { icon: <Download className="w-4 h-4" />, label: "Download", action: handleDownload, loading: isDownloading },
            { icon: <Save className="w-4 h-4" />, label: "Save", action: handleWatchLater, active: isWatchLater },
          ].map((item, idx) => (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-14 px-8 rounded-3xl bg-white/[0.03] backdrop-blur-3xl border border-white/5 hover:bg-white/[0.08] font-black text-[10px] tracking-widest gap-4 transition-all duration-500 uppercase italic whitespace-nowrap ${item.loading ? "animate-pulse" : ""} ${item.active ? "text-zinc-200 border-white/20 bg-white/5 shadow-2xl" : "text-zinc-500 hover:text-white"}`}
                    onClick={item.action}
                  >
                    {item.icon}
                    <span className="hidden leading-none pt-1">{item.label}</span>
                  </Button>
                </TooltipTrigger>
                {item.label === "Download" && (
                  <TooltipContent className="bg-zinc-950 text-white font-black text-[9px] uppercase tracking-[0.3em] border border-white/10 px-4 py-2 rounded-xl italic mt-2 animate-in zoom-in fade-in">
                    {user?.plan && user.plan !== "FREE" ? "✨ Unlimited Downloads Enabled" : "1/Day Free Limit"}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}

          <Button
            variant="ghost"
            size="icon"
            className="h-14 w-14 rounded-3xl bg-white/[0.03] backdrop-blur-3xl border border-white/5 hover:bg-white/[0.08] text-zinc-500 flex-shrink-0 transition-all duration-500 hover:rotate-90"
            onClick={() => toast("Statistics", {
              description: "Detailed video statistics.",
              action: {
                label: "Audit",
                onClick: () => {}
              }
            })}
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>

          {user?._id === (video.uploader?._id || video.uploader) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 rounded-3xl bg-white/5 border border-white/10 hover:bg-white hover:text-black text-zinc-400 flex-shrink-0 transition-all duration-500"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-950 text-white font-black text-[10px] uppercase tracking-[0.4em] border border-white/10 px-4 py-2 rounded-xl italic mt-2">
                  Purge Content
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="group relative bg-white/[0.02] dark:bg-zinc-950/40 backdrop-blur-3xl rounded-[2.5rem] p-8 mt-10 border border-white/5 transition-all duration-700 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_0_50px_-12px_rgba(255,255,255,0.05)] overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.01] blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/[0.01] blur-[80px] rounded-full pointer-events-none" />
        
        <div className="flex flex-wrap gap-6 font-black text-[9px] uppercase tracking-[0.4em] text-zinc-500 mb-6 relative z-10 italic">
          <div className="flex items-center gap-2.5 bg-white/[0.03] px-4 py-2 rounded-xl border border-white/5">
             <Globe className="w-3.5 h-3.5 text-zinc-600" />
             <span className="text-zinc-300">{(video.views || 0).toLocaleString()} <span className="text-zinc-600">views</span></span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/[0.03] px-4 py-2 rounded-xl border border-white/5">
             <Activity className="w-3.5 h-3.5 text-zinc-600" />
             <span className="text-zinc-300">{safeTimeAgo(video.createdAt)}</span>
          </div>
          {user?.plan && user.plan !== "FREE" && (
            <div className="flex items-center gap-2.5 bg-yellow-500/10 px-4 py-2 rounded-xl border border-yellow-500/20 animate-pulse">
               <Crown className="w-3.5 h-3.5 text-yellow-500" />
               <span className="text-yellow-500">{user.plan} MEMBER</span>
            </div>
          )}
        </div>
        
        <div className={`relative z-10 transition-all duration-1000 ease-in-out overflow-hidden ${showFullDescription ? "max-h-[5000px]" : "max-h-[100px]"}`}>
           <div className="space-y-4">
             <p className="text-[15px] font-bold leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors whitespace-pre-wrap italic tracking-tight">
               {video.videodescription || "No description provided for this broadcast."}
             </p>
           </div>
        </div>
        
        <button
          className="relative z-10 mt-6 flex items-center gap-4 font-black text-[9px] uppercase tracking-[0.4em] text-zinc-500 hover:text-white transition-all group/btn italic"
          onClick={() => setShowFullDescription(!showFullDescription)}
        >
          <div className="w-6 h-[2px] bg-zinc-700/50 group-hover/btn:w-12 transition-all duration-500" />
          {showFullDescription ? "Show Less" : "Show More"}
          <div className={`transition-transform duration-500 ${showFullDescription ? "rotate-180" : ""}`}>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default VideoInfo;
