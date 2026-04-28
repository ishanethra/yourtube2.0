import React, { useEffect, useState } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import Link from "next/link";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";
import { safeDateLabel } from "@/lib/date";
import { CheckCircle2, Youtube, HardDrive, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const DownloadsPage = () => {
  const { user } = useUser();
  const [downloads, setDownloads] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return;
      try {
        const res = await axiosInstance.get(`/video/downloads/${user._id}`);
        const resolvedDownloads = res.data.map((item: any) => {
          if (typeof item.videoid === "string") {
            const sample = sampleYoutubeVideos.find((v) => v._id === item.videoid);
            return { ...item, videoid: sample };
          }
          return item;
        });
        setDownloads(resolvedDownloads.filter((item: any) => item.videoid));
      } catch (error) {
        console.error("Error loading downloads:", error);
      }
    };
    load();
  }, [user?._id]);

  return (
    <main className="flex-1 p-4">
      <h1 className="text-2xl font-semibold mb-4">Downloads</h1>
      {!user && <p>Please sign in to view downloads.</p>}
      {user && downloads.length === 0 && <p>No downloads yet.</p>}
      <div className="grid gap-4">
        {downloads.map((item) => (
          <div key={item._id} className="group relative bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-[#1a1a1a] hover:border-white/10 shadow-xl overflow-hidden">
            {/* Success background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
            
            <div className="flex items-center gap-4 relative">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500">
                {item.videoid?.youtubeId ? <Youtube className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
              </div>
              
              <div className="space-y-1">
                <p className="font-black text-white tracking-tight">{item.videoid?.videotitle}</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Successfully Uploaded
                  </div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    {safeDateLabel(item.downloadedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              {item.videoid?.youtubeId ? (
                <Link
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-black text-xs uppercase tracking-widest transition-all hover:bg-gray-200 active:scale-95"
                  href={`/watch/${item.videoid._id}`}
                >
                  Watch Now
                </Link>
              ) : (
                <a
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest transition-all hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
                  href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${item.videoid?.filepath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download className="w-4 h-4" />
                  Get MP4
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default DownloadsPage;
