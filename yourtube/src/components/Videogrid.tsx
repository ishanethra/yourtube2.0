import React, { useEffect, useState } from "react";
import Videocard from "./videocard";
import axiosInstance from "@/lib/axiosinstance";
import { sampleYoutubeVideos } from "@/lib/sampleVideos";

const Videogrid = ({ activeCategory = "All" }: { activeCategory?: string }) => {
  const [videos, setvideo] = useState<any>(null);
  const [loading, setloading] = useState(true);

  useEffect(() => {
    const fetchvideo = async () => {
      try {
        const res = await axiosInstance.get("/video/getall");
        setvideo(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchvideo();
  }, []);

  const dynamicFeed = Array.isArray(videos) ? videos : [];
  const allFeed = [...dynamicFeed, ...sampleYoutubeVideos];
  const feed =
    activeCategory === "All"
      ? allFeed
      : allFeed.filter((video: any) => video?.category === activeCategory);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {loading ? (
        <>Loading..</>
      ) : (
        feed.map((video: any) => <Videocard key={video._id} video={video} />)
      )}
    </div>
  );
};

export default Videogrid;
