import React, { useEffect, useState } from "react";
import Link from "next/link";
import { safeTimeAgo, safeNumber } from "@/lib/date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axiosInstance from "@/lib/axiosinstance";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";

const SearchResult = ({ query }: any) => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query?.trim()) return;

    const fetchAndFilter = async () => {
      setLoading(true);
      setSearched(false);

      let allVideos: any[] = [...sampleYoutubeVideos];

      try {
        const res = await axiosInstance.get("/video/getall");
        if (Array.isArray(res.data)) {
          allVideos = [...res.data, ...allVideos];
        }
      } catch (_) {
        // backend may be offline – fall back to sample videos only
      }

      const q = query.toLowerCase();
      const filtered = allVideos.filter(
        (vid: any) =>
          vid.videotitle?.toLowerCase().includes(q) ||
          vid.videochanel?.toLowerCase().includes(q) ||
          (typeof vid.uploader === "string" && vid.uploader.toLowerCase().includes(q)) ||
          vid.uploader?.name?.toLowerCase().includes(q)
      );

      setResults(filtered);
      setLoading(false);
      setSearched(true);
    };

    fetchAndFilter();
  }, [query]);

  if (!query?.trim()) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Enter a search term to find videos and channels.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (searched && results.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-zinc-500">Try different keywords or remove search filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {results.map((vid: any) => {
          const channelName = vid.videochanel || "Unknown";
          const uploaderStr =
            typeof vid.uploader === "string" ? vid.uploader : vid.uploader?._id || "";
          const thumbnail = vid.youtubeId
            ? `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`
            : vid.thumbnailPath
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/${vid.thumbnailPath}`
            : null;

          return (
            <div key={vid._id} className="flex flex-col sm:flex-row gap-4 group">
              <Link href={`/watch/${vid._id}`} className="flex-shrink-0 w-full sm:w-auto">
                <div className="relative w-full sm:w-72 md:w-80 aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={vid.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                      No Preview
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex-1 min-w-0 py-1">
                <Link href={`/watch/${vid._id}`}>
                  <h3 className="font-bold text-base sm:text-lg line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-indigo-400 mb-1 transition-colors text-black dark:text-white">
                    {vid.videotitle}
                  </h3>
                </Link>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-500 mb-2">
                  <span>{safeNumber(vid.views).toLocaleString()} views</span>
                  <span>•</span>
                  <span>{safeTimeAgo(vid.createdAt)}</span>
                  {vid.category && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">{vid.category}</span>
                    </>
                  )}
                </div>

                <Link
                  href={`/channel/${uploaderStr}`}
                  className="flex items-center gap-2 mb-2 hover:text-zinc-900 dark:hover:text-indigo-400 transition-colors w-fit"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                      {channelName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-zinc-500 font-medium">{channelName}</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div className="text-center py-4">
          <p className="text-zinc-500 text-sm italic">
            Showing {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResult;
