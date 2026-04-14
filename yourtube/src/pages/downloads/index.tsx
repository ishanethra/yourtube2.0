import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const DownloadsPage = () => {
  const { user } = useUser();
  const [downloads, setDownloads] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return;
      const res = await axiosInstance.get(`/video/downloads/${user._id}`);
      setDownloads(res.data);
    };
    load();
  }, [user?._id]);

  return (
    <main className="flex-1 p-4">
      <h1 className="text-2xl font-semibold mb-4">Downloads</h1>
      {!user && <p>Please sign in to view downloads.</p>}
      {user && downloads.length === 0 && <p>No downloads yet.</p>}
      <div className="space-y-3">
        {downloads.map((item) => (
          <div key={item._id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{item.videoid?.videotitle}</p>
              <p className="text-xs text-gray-500">Downloaded: {new Date(item.downloadedAt).toLocaleString()}</p>
            </div>
            <Link
              className="text-blue-600 underline"
              href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${item.videoid?.filepath}`}
              target="_blank"
            >
              Open file
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
};

export default DownloadsPage;
