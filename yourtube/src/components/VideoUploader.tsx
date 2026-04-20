import { Check, FileVideo, Upload, X } from "lucide-react";
import React, { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import axiosInstance from "@/lib/axiosinstance";

const VideoUploader = ({ channelId, channelName }: any) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const handlefilechange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        toast.error("Please upload a valid video file.");
        return;
      }
      setVideoFile(file);
      const filename = file.name;
      if (!videoTitle) {
        setVideoTitle(filename.replace(/\.[^/.]+$/, ""));
      }
      
      // Auto-capture thumbnail preview
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = videoUrl;
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
            if (!thumbnailFile) {
              setThumbnailFile(capturedFile);
              setThumbnailPreview(URL.createObjectURL(blob));
            }
          }
        }, "image/jpeg");
        URL.revokeObjectURL(videoUrl);
      };
    }
  };

  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload a valid image file.");
        return;
      }
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setVideoFile(null);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setVideoTitle("");
    setIsUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!videoFile || !videoTitle.trim()) {
      toast.error("Please provide video and title");
      return;
    }
    const formdata = new FormData();
    formdata.append("file", videoFile);
    if (thumbnailFile) {
      formdata.append("thumbnail", thumbnailFile);
    }
    formdata.append("videotitle", videoTitle);
    formdata.append("videochanel", channelName);
    formdata.append("uploader", channelId);
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      await axiosInstance.post("/video/upload", formdata, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progresEvent: any) => {
          const progress = Math.round((progresEvent.loaded * 100) / progresEvent.total);
          setUploadProgress(progress);
        },
      });
      toast.success("Video uploaded successfully with thumbnail");
      resetForm();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-8 border shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Upload Video</h2>

      <div className="space-y-6">
        {!videoFile ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-xl font-semibold text-gray-700">Select video to upload</p>
            <p className="text-gray-500 mt-2">MP4, WebM, MOV or AVI • Up to 100MB</p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/*"
              onChange={handlefilechange}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Video File</Label>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border mt-1.5">
                    <FileVideo className="w-8 h-8 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{videoFile.name}</p>
                      <p className="text-xs text-gray-500">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    {!isUploading && (
                      <Button variant="ghost" size="icon" onClick={() => setVideoFile(null)} className="rounded-full text-gray-400 hover:text-red-500">
                        <X className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="title" className="text-sm font-semibold text-gray-700">Video Title</Label>
                  <Input
                    id="title"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Enter a catchy title"
                    className="mt-1.5 h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-700">Video Thumbnail</Label>
                <div 
                  className="relative aspect-video bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 flex flex-center transition-all overflow-hidden group cursor-pointer hover:border-blue-500"
                  onClick={() => thumbInputRef.current?.click()}
                >
                  {thumbnailPreview ? (
                    <>
                      <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm font-medium">Change Image</p>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Select Thumbnail</p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={thumbInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                  />
                </div>
                <p className="text-[11px] text-gray-400 leading-tight">
                  High-quality thumbnails stand out. If you don't select one, we'll automatically capture a frame from your video.
                </p>
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-blue-600 italic">Publishing...</span>
                  <span className="text-gray-600">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2 bg-gray-100" />
              </div>
            )}

            <div className="flex justify-end pt-4 border-t gap-3">
              <Button variant="outline" onClick={resetForm} disabled={isUploading} className="rounded-xl px-6 h-12">
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || !videoTitle.trim()} className="rounded-xl px-8 h-12 bg-blue-600 hover:bg-blue-700 font-bold">
                {isUploading ? "Uploading..." : "Publish Video"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;
