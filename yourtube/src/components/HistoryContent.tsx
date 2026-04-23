"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { safeTimeAgo, safeNumber } from "@/lib/date";
import { MoreVertical, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { toast } from "sonner";

export default function HistoryContent() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      loadHistory();
    } else {
      setLoading(true);
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;

    try {
      const historyData = await axiosInstance.get(`/history/${user?._id}`);
      
      // Hydrate YouTube samples that are just strings
      const hydrated = historyData.data.map((item: any) => {
        if (typeof item.videoid === "string") {
          const sample = sampleYoutubeVideos.find(v => v._id === item.videoid);
          return { ...item, videoid: sample || { _id: item.videoid, videotitle: "Unknown Video" } };
        }
        return item;
      });

      setHistory(hydrated);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading history...</div>;
  }

  const handleRemoveFromHistory = async (historyId: string) => {
    try {
      await axiosInstance.delete(`/history/${historyId}`);
      setHistory(prev => prev.filter((item) => item._id !== historyId));
      toast.success("Removed from history");
    } catch (error) {
      console.error("Error removing from history:", error);
      toast.error("Failed to remove from history");
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          Keep track of what you watch
        </h2>
        <p className="text-gray-600">
          Watch history isn't viewable when signed out.
        </p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No watch history yet</h2>
        <p className="text-gray-600">Videos you watch will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{history.length} videos</p>
      </div>

      <div className="space-y-4">
        {history.map((item) => (
          <div key={item._id} className="flex gap-4 group">
            <Link href={`/watch/${item.videoid?._id}`} className="flex-shrink-0">
              <div className="relative w-40 aspect-video bg-gray-100 rounded overflow-hidden">
                {item.videoid?.youtubeId ? (
                   <img 
                      src={`https://img.youtube.com/vi/${item.videoid.youtubeId}/mqdefault.jpg`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      alt={item.videoid.videotitle}
                   />
                ) : (
                  <video
                    src={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${item.videoid?.filepath}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/watch/${item.videoid?._id}`}>
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600 mb-1">
                  {item.videoid?.videotitle}
                </h3>
              </Link>
              <p className="text-sm text-gray-600">
                {item.videoid?.videochanel || "Unknown Channel"}
              </p>
              <p className="text-sm text-gray-600">
                {safeNumber(item.videoid?.views)} views •{" "}
                {safeTimeAgo(item.videoid?.createdAt)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Added {safeTimeAgo(item.createdAt)}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleRemoveFromHistory(item._id)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove from watch history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
