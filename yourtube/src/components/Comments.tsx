import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useUser } from "@/lib/AuthContext";
import { useAppStatus } from "@/lib/ContextManager";
import axiosInstance from "@/lib/axiosinstance";
import { safeTimeAgo } from "@/lib/date";
import {
  ThumbsUp, ThumbsDown, User, ListFilter, Languages,
  MapPin, AlertCircle, MoreVertical, Edit2, Trash2,
  CornerDownRight, Globe, ChevronDown, ChevronRight,
  Activity, Command, MessageSquare, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// ── Language metadata (All major languages) ──────────────────────────────────
const LANG_NAMES: Record<string, string> = {
  en:"English", hi:"Hindi", ta:"Tamil", te:"Telugu", kn:"Kannada",
  ml:"Malayalam", fr:"French", es:"Spanish", de:"German", zh:"Chinese",
  ar:"Arabic", ja:"Japanese", ru:"Russian", pt:"Portuguese", it:"Italian",
  ko:"Korean", bn:"Bengali", gu:"Gujarati", mr:"Marathi", pa:"Punjabi",
  ur:"Urdu", tr:"Turkish", vi:"Vietnamese", th:"Thai", id:"Indonesian",
};

const FLAG_MAP: Record<string, string> = {
  en:"🇬🇧", hi:"🇮🇳", ta:"🇮🇳", te:"🇮🇳", kn:"🇮🇳", ml:"🇮🇳",
  fr:"🇫🇷", es:"🇪🇸", de:"🇩🇪", zh:"🇨🇳", ar:"🇸🇦", ja:"🇯🇵",
  ru:"🇷🇺", pt:"🇧🇷", it:"🇮🇹", ko:"🇰🇷", bn:"🇧🇩",
};

// Default target language for translations
const DEFAULT_LANG_CODE = (
  typeof navigator !== "undefined"
    ? (navigator.language || "en").split("-")[0].toLowerCase()
    : "en"
);

// ── Precise city via Geolocation + Nominatim ─────────────────────────────────
// Returns true only if the string is entirely Latin/ASCII characters (English-safe)
const isLatinText = (str: string) => /^[\u0000-\u024F\s,.\-']+$/.test(str);

async function fetchPreciseCity(user?: any): Promise<string> {
  // Priority 1: Use stored city – BUT only if it is already in Latin/English script
  if (user?.city && isLatinText(user.city)) return user.city;

  const fetchIPAPI = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      return data.city || data.region || "Unknown";
    } catch { return "Unknown"; }
  };

  const fetchIP_API = async () => {
    try {
      // Use HTTPS version (ipapi.co is a reliable fallback for ip-api's free tier)
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      return data.city || data.region || "Unknown";
    } catch { return "Unknown"; }
  };

  const fetchByGeolocation = async (): Promise<string> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return "Unknown";
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            // namedetails=1 gives us name:en for English transliterations of local names
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&zoom=18&accept-language=en&namedetails=1`
            );
            const data = await res.json();
            // Prefer explicit English name from namedetails, then fall back to address fields
            const candidates = [
              data.namedetails?.["name:en"],
              data.address?.suburb,
              data.address?.neighbourhood,
              data.address?.village,
              data.address?.town,
              data.address?.city_district,
              data.address?.city,
            ];
            // Pick the first candidate that is Latin/English
            const englishName = candidates.find(c => c && isLatinText(c)) || "Unknown";
            resolve(englishName);
          } catch { resolve("Unknown"); }
        },
        () => resolve("Unknown"),
        { timeout: 800, enableHighAccuracy: true }
      );
    });
  };

  // Parallel fetch for non-logged-in users
  const [c1, c2, c3] = await Promise.all([fetchByGeolocation(), fetchIP_API(), fetchIPAPI()]);
  const result = c1 !== "Unknown" ? c1 : (c2 !== "Unknown" ? c2 : c3);

  // Final safety net: if the result is still non-Latin, return "Unknown" rather than showing garbled text
  return isLatinText(result) ? result : "Unknown";
}

// ─────────────────────────────────────────────────────────────────────────────


interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  commentbody: string;
  createdAt: string;
  usercommented?: string;
  userimage?: string;
  city?: string;
  language?: string;
  languageName?: string;
  detectedLang?: string;
  likeCount?: number;
  dislikeCount?: number;
  likedBy?: string[];
  dislikedBy?: string[];
  parentCommentId?: string | null;
  // replies specifically for threaded UI
  replies?: Comment[];
}

const safeTimestamp = (value?: string | null) => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string | null; info: string }
  | { status: "error"; info: string };

interface CommentItemProps {
  comment: Comment;
  onRefresh: () => void;
  userCity: string;
  isReply?: boolean;
  setShowErrorModal: (show: boolean) => void;
}

// Centralized validation for 100% feature compliance
const validateCommentText = (text: string): { valid: boolean; error: string | null } => {
  if (!text.trim()) return { valid: false, error: null };
  // Strict special character moderation: Block @, $, #, !, etc. as requested
  const STRICT_BLOCK_REGEX = /[<>{}\[\]\\\/|~^\*+=@$#%!^&()?;:]/;
  if (STRICT_BLOCK_REGEX.test(text)) {
    return {
      valid: false,
      error: "Comment contains restricted characters (@, $, #, !, etc). Please use standard text."
    };
  }
  return { valid: true, error: null };
};

// ── CommentItem ───────────────────────────────────────────────────────────────
const CommentItem = ({ comment, onRefresh, userCity, isReply = false, setShowErrorModal }: CommentItemProps) => {
  const { user, handlegooglesignin, activeChannel } = useUser();
  
  // Use a fallback to prevent destructuring errors if ContextManager handles it differently
  let region = "";
  try {
    const status = useAppStatus() as any;
    region = status?.locationData?.state || status?.locationData?.region || "";
  } catch(e) {
    // context not available 
  }
  
  // v2.0 Rule: If a comment has 2 or more dislikes, it is automatically removed/hidden
  const dislikeCount = comment.dislikeCount ?? (comment.dislikedBy?.length || 0);
  if (dislikeCount >= 2) return null;

  const isSouthIndia = ["Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana"].some(
    s => region?.includes(s)
  );

  const [translation,   setTranslation]   = useState<TranslationState>({ status: "idle" });
  const [targetLang,    setTargetLang]    = useState(DEFAULT_LANG_CODE);
  const [isEditing,     setIsEditing]     = useState(false);
  const [editValue,     setEditValue]     = useState(comment.commentbody);
  const [showReply,     setShowReply]     = useState(false);
  const [replyValue,    setReplyValue]    = useState("");
  const [showRepliesUI, setShowRepliesUI] = useState(false);
  const sourceLangCode = String(comment.language || comment.detectedLang || "en").toLowerCase();

  // ── Translate ──────────────────────────────────────────────────────────────
  const handleTranslate = async (lang?: string) => {
    const code = lang || targetLang;
    if (translation.status === "loading") return;

    setTranslation({ status: "loading" });
    try {
      const gtRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${code}&dt=t&q=${encodeURIComponent(comment.commentbody)}`
      );
      const gtData = await gtRes.json();
      const translated = gtData?.[0]?.map((s: any) => s?.[0]).join("") || null;
      const detectedLang = gtData?.[2] || "auto";
      const detectedName = LANG_NAMES[detectedLang] || detectedLang;

      if (!translated || translated.trim() === comment.commentbody.trim()) {
        setTranslation({ status: "done", text: null, info: `Already in ${LANG_NAMES[code] || code}` });
      } else {
        setTranslation({ status: "done", text: translated, info: `Translated from ${detectedName} to ${LANG_NAMES[code] || code}` });
      }
    } catch {
      setTranslation({ status: "error", info: "Translation unavailable" });
    }
  };

  const handleVote = async (voteType: "like" | "dislike") => {
    if (!user) return handlegooglesignin();
    try {
      await axiosInstance.post(`/comment/${comment._id}/vote`, {
        userId: user._id,
        voteType,
      });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    try {
      await axiosInstance.delete(`/comment/${comment._id}`);
      toast.success("Comment deleted");
      onRefresh();
    } catch { toast.error("Failed to delete"); }
  };

  const handleEditSave = async () => {
    const { valid, error } = validateCommentText(editValue);
    if (!valid) {
      if (error) {
        setShowErrorModal(true);
      }
      return;
    }
    if (editValue === comment.commentbody) { setIsEditing(false); return; }
    try {
      await axiosInstance.patch(`/comment/${comment._id}`, { commentbody: editValue });
      setIsEditing(false);
      onRefresh();
    } catch { toast.error("Failed to update"); }
  };

  const handlePostReply = async () => {
    const { valid, error } = validateCommentText(replyValue);
    if (!valid) {
      if (error) {
        setShowErrorModal(true);
      }
      return;
    }
    if (!user) return;
    try {
      await axiosInstance.post("/comment/postcomment", {
        videoid: comment.videoid,
        userid: user._id,
        commentbody: replyValue,
        usercommented: activeChannel ? activeChannel.name : user.name,
        userimage: activeChannel ? "" : user.image,
        city: userCity || "Unknown",
        parentCommentId: comment._id,
      });
      setReplyValue("");
      setShowReply(false);
      setShowRepliesUI(true);
      onRefresh();
    } catch { toast.error("Failed to reply"); }
  };

  const isOwner = user && user._id === comment.userid;
  const likeCount    = comment.likeCount    ?? (comment.likedBy?.length || 0);
  const userLiked    = comment.likedBy?.includes(user?._id);
  const userDisliked = comment.dislikedBy?.includes(user?._id);

  return (
    <div className={`flex gap-5 group relative animate-in fade-in slide-in-from-bottom-4 duration-700 ${isReply ? "pl-2" : ""}`}>
      {isReply && (
        <div className="absolute -left-3 top-[-10px] bottom-[20px] w-px bg-white/10" />
      )}
      
      <Avatar className={`${isReply ? "w-8 h-8" : "w-12 h-12"} shrink-0 rounded-2xl border border-black/5 dark:border-white/5 shadow-2xl transition-transform duration-500 group-hover:scale-105`}>
        <AvatarImage src={comment.userimage} className="object-cover" />
        <AvatarFallback className="bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white text-[10px] font-black italic">
          {comment.usercommented?.[0] || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Author + Time */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] font-black text-black dark:text-white hover:text-zinc-400 dark:hover:text-zinc-500 transition-colors italic tracking-tighter">
            @{comment.usercommented?.toLowerCase().replace(/\s+/g, "") || "user"}
          </span>
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <span className="text-[10px] font-black text-zinc-600 uppercase italic tracking-tight">
            {safeTimeAgo(comment.createdAt)}
          </span>
          {/* v2.0 Rule: Each comment should also display the user’s exact city name for context */}
          {comment.city ? (
            <span className="flex items-center gap-2 text-[9px] font-black text-zinc-500 bg-zinc-100 dark:bg-white/[0.03] px-3 py-1.5 rounded-full border border-black/10 dark:border-white/5 italic tracking-[0.1em] ml-2">
              <MapPin className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500" /> {comment.city}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[9px] font-black text-zinc-500 bg-zinc-100 dark:bg-white/[0.03] px-3 py-1.5 rounded-full border border-black/10 dark:border-white/5 italic tracking-[0.1em] ml-2 opacity-50">
              <MapPin className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500" /> Remote Loc
            </span>
          )}
        </div>

        {/* Text */}
        {isEditing ? (
          <div className="mt-4 space-y-4">
            <textarea
              className="w-full bg-white/[0.02] border border-white/10 focus:border-zinc-500 outline-none text-[15px] p-6 rounded-[2rem] text-white resize-none min-h-[120px] font-bold italic"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-full text-[10px] font-black uppercase tracking-widest italic text-zinc-500">Cancel</Button>
              <Button size="sm" onClick={handleEditSave} className="rounded-full bg-white text-black hover:bg-zinc-200 hover:text-black px-8 h-10 text-[10px] font-black uppercase tracking-widest italic">Save</Button>
            </div>
          </div>
        ) : (
          <div className="text-[15px] text-zinc-400 leading-relaxed relative">
            {translation.status === "done" && translation.text ? (
              <div className="space-y-3">
                <div className="relative p-6 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 backdrop-blur-3xl group/trans">
                  <div className="flex items-center gap-2 mb-3 opacity-40">
                     <Languages className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] italic">Translation</p>
                  </div>
                  <p className="text-zinc-900 dark:text-indigo-100 font-bold italic text-lg leading-relaxed">
                    {translation.text}
                  </p>
                  <button 
                    onClick={() => setTranslation({ status: "idle" })} 
                    className="absolute top-6 right-6 p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all scale-75 opacity-0 group-hover/trans:opacity-100 group-hover/trans:scale-100"
                  >
                    <Command className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-bold text-zinc-800 dark:text-zinc-300 leading-relaxed px-1 text-lg italic tracking-tight">
                {comment.commentbody}
              </p>
            )}
            {translation.status === "loading" && (
              <div className="flex items-center gap-3 mt-4 px-4 py-2 bg-indigo-500/10 rounded-full w-fit border border-indigo-500/20 animate-pulse">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span className="text-[9px] font-black text-indigo-400 tracking-[0.4em] uppercase italic">Translating...</span>
              </div>
            )}
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center gap-2 mt-6">
          <button 
            onClick={() => handleVote("like")} 
            className={`flex items-center gap-2 h-10 px-4 rounded-2xl transition-all duration-500 ${userLiked ? "bg-black dark:bg-white text-white dark:text-black shadow-2xl scale-105" : "bg-zinc-100 dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5"}`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${userLiked ? "fill-current" : ""}`} />
            <span className="text-[10px] font-black uppercase italic tracking-tighter">{likeCount > 0 ? likeCount : "00"}</span>
          </button>
          
          <button 
            onClick={() => handleVote("dislike")} 
            className={`flex items-center gap-2 h-10 px-4 rounded-2xl transition-all duration-500 ${userDisliked ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black shadow-2xl scale-105" : "bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5"}`}
          >
            <ThumbsDown className={`w-3.5 h-3.5 ${userDisliked ? "fill-current" : ""}`} />
            <span className="text-[10px] font-black uppercase italic tracking-tighter">{dislikeCount > 0 ? dislikeCount : "00"}</span>
          </button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowReply(!showReply)} 
            className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 hover:text-white rounded-2xl h-10 px-6 ml-2 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] transition-all italic"
          >
            REPLY
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 rounded-2xl p-0 bg-zinc-100 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-all">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto w-64 bg-white/95 dark:bg-black/90 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-3xl shadow-3xl animate-in zoom-in-95 duration-200 p-2">
              <div className="px-6 py-4 text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 mb-2 bg-zinc-50 dark:bg-white/[0.02] rounded-t-2xl italic">Translate</div>
              {Object.entries(LANG_NAMES)
                .filter(([code]) => code.toLowerCase() !== sourceLangCode)
                .map(([code, name]) => (
                <DropdownMenuItem key={code} onClick={() => handleTranslate(code)} className="text-[10px] font-black py-4 px-5 rounded-2xl focus:bg-black dark:focus:bg-white focus:text-white dark:focus:text-black transition-all cursor-pointer mb-1 uppercase tracking-widest italic mx-1">
                  <span className="mr-4 text-base flex items-center">{FLAG_MAP[code] || "🌐"}</span> {name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 w-10 rounded-2xl p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-white/[0.08] bg-white/[0.02] border border-white/5">
                  <MoreVertical className="w-3.5 h-3.5 text-zinc-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-3xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden p-2">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="text-[10px] font-black py-5 px-6 rounded-2xl flex items-center gap-4 cursor-pointer focus:bg-white focus:text-black transition-all mb-1 uppercase tracking-widest italic">
                  <Edit2 className="w-4 h-4 text-zinc-500 group-hover:text-black" /> Edit
                </DropdownMenuItem>
                <div className="h-px bg-white/5 my-1" />
                <DropdownMenuItem onClick={handleDelete} className="text-[10px] font-black py-5 px-6 rounded-2xl flex items-center gap-4 text-zinc-500 cursor-pointer focus:bg-white focus:text-black transition-all uppercase tracking-widest italic">
                  <Trash2 className="w-4 h-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Reply Input */}
        {showReply && (
          <div className="flex gap-5 mt-8 p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden group/reply">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800" />
            <Avatar className="w-10 h-10 rounded-2xl border border-white/10">
              <AvatarImage src={user?.image} className="object-cover" />
              <AvatarFallback className="font-black italic bg-zinc-900">{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <input
                className="w-full bg-transparent border-b border-white/10 focus:border-zinc-500 outline-none text-[15px] py-2 text-white font-bold italic tracking-tight"
                placeholder="Add a reply..."
                value={replyValue}
                onChange={(e) => setReplyValue(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowReply(false)} className="rounded-full text-[9px] font-black uppercase tracking-widest italic text-zinc-500">Cancel</Button>
                <Button size="sm" onClick={handlePostReply} disabled={!replyValue.trim()} className="rounded-full bg-white text-black hover:bg-zinc-200 hover:text-black px-8 h-10 text-[9px] font-black uppercase tracking-widest italic">Reply</Button>
              </div>
            </div>
          </div>
        )}

        {/* Nesting logic */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-6 ml-2">
            <button 
              onClick={() => setShowRepliesUI(!showRepliesUI)}
              className={`flex items-center gap-3 px-6 py-2.5 rounded-full text-[11px] font-black transition-all uppercase tracking-widest italic ${showRepliesUI ? "bg-white text-black shadow-xl" : "bg-white/[0.03] text-zinc-500 border border-white/5 hover:bg-white/[0.08] hover:text-white"}`}
            >
              {showRepliesUI ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {comment.replies.length.toString().padStart(2, '0')} REPLIES
            </button>
            {showRepliesUI && (
              <div className="mt-8 space-y-12 pl-6 relative">
                 <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
                {comment.replies.map((reply) => (
                  <CommentItem key={reply._id} comment={reply} onRefresh={onRefresh} userCity={userCity} isReply={true} setShowErrorModal={setShowErrorModal} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Comments Component ───────────────────────────────────────────────────
const Comments = ({ videoId }: { videoId: string }) => {
  const { user, handlegooglesignin, activeChannel } = useUser();
  const [rawComments,  setRawComments]  = useState<Comment[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const [newComment,   setNewComment]   = useState("");
  const [loading,      setLoading]      = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused,    setIsFocused]    = useState(false);
  const [userCity,     setUserCity]     = useState("Unknown");
  const [cityFetching, setCityFetching] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    const init = async () => {
      const city = await fetchPreciseCity(user);
      setUserCity(city);
      setCityFetching(false);
    };
    init();
  }, [user]);

  useEffect(() => { fetchComments(); }, [videoId]);

  const fetchComments = async () => {
    if (!videoId) return;
    try {
      const res = await axiosInstance.get(`/comment/all/${videoId}`);
      setRawComments(res.data);
    } catch (err: any) { 
      // Silently handle 404s for sample videos (e.g. gaming-1) that don't exist in the DB yet
      if (err.response?.status !== 404) {
        console.error("Comment fetch error:", err); 
      }
      setRawComments([]); // Ensure empty list on error
    } finally { 
      setLoading(false); 
    }
  };

  const handlePostComment = async () => {
    const { valid, error } = validateCommentText(newComment);
    if (!valid || !videoId) {
      if (error) setShowErrorModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post("/comment/postcomment", {
        videoid: videoId,
        userid: user._id,
        commentbody: newComment,
        usercommented: activeChannel ? activeChannel.name : user.name,
        userimage: activeChannel ? "" : user.image,
        city: userCity,
      });
      fetchComments();
      setNewComment("");
      setIsFocused(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to post comment");
    } finally { setIsSubmitting(false); }
  };

  const nestedComments = useMemo(() => {
    const map: Record<string, Comment> = {};
    const roots: Comment[] = [];
    rawComments.forEach(c => { map[c._id] = { ...c, replies: [] }; });
    rawComments.forEach(c => {
      if (c.parentCommentId && map[c.parentCommentId]) map[c.parentCommentId].replies?.push(map[c._id]);
      else roots.push(map[c._id]);
    });
    return roots;
  }, [rawComments]);

  const sortedRoots = useMemo(() => {
    return [...nestedComments].sort((a, b) => {
      if (sortBy === "top") return (b.likeCount || 0) - (a.likeCount || 0);
      return safeTimestamp(b.createdAt) - safeTimestamp(a.createdAt);
    });
  }, [nestedComments, sortBy]);

  if (loading) return (
    <div className="space-y-10 pt-10">
       <div className="h-8 w-48 bg-white/[0.03] rounded-2xl animate-pulse" />
       <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="flex gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] animate-pulse" />
                <div className="flex-1 space-y-3 pt-2">
                   <div className="h-4 w-1/4 bg-white/[0.02] rounded-full animate-pulse" />
                   <div className="h-10 w-full bg-white/[0.03] rounded-3xl animate-pulse" />
                </div>
             </div>
          ))}
       </div>
    </div>
  );

  return (
    <div id="comments-section" className="space-y-12 pt-16 relative">
      {/* Security Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowErrorModal(false)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md p-10 rounded-[3rem] border border-black/10 dark:border-white/10 shadow-3xl text-center space-y-6 overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
             <div className="w-20 h-20 bg-red-500/10 rounded-3xl mx-auto flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-black dark:text-white">Security Block</h3>
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
                  Comment contains restricted characters (@, $, #, !, etc). Please use standard text.
                </p>
             </div>
             <Button onClick={() => setShowErrorModal(false)} className="w-full h-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest italic hover:scale-105 active:scale-95 transition-all text-[10px]">
                I Understand
             </Button>
          </div>
        </div>
      )}
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Header: Sort + Count */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
            <div className="flex items-center gap-3 opacity-40">
              <MessageSquare className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.6em] italic text-zinc-400 dark:text-zinc-500">Comments</p>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-black dark:text-white italic tracking-tighter uppercase leading-none">
              Comments <span className="text-zinc-300 dark:text-zinc-700">({rawComments.length.toString().padStart(2, '0')})</span>
            </h2>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-3 h-12 px-6 rounded-2xl bg-white/[0.02] border border-white/5 font-black text-[10px] uppercase tracking-widest italic hover:bg-white/[0.08] hover:text-white transition-all">
              <ListFilter className="w-4 h-4 text-zinc-600" /> Sort by
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-black/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-3xl p-2 w-56">
            <DropdownMenuItem onClick={() => setSortBy("top")} className="text-[10px] font-black py-4 px-5 rounded-2xl focus:bg-white focus:text-black transition-all cursor-pointer mb-1 uppercase tracking-widest italic mx-1">
              Top comments
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy("newest")} className="text-[10px] font-black py-4 px-5 rounded-2xl focus:bg-white focus:text-black transition-all cursor-pointer mb-1 uppercase tracking-widest italic mx-1">
              Newest first
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add Comment Input */}
      {user ? (
        <div className={`group flex gap-6 p-10 rounded-[4rem] transition-all duration-1000 bg-zinc-50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 relative overflow-hidden ${isFocused ? "bg-zinc-100 dark:bg-white/[0.03] border-black/10 dark:border-white/10 shadow-3xl scale-[1.02]" : "hover:border-black/10 dark:hover:border-white/10"}`}>
           {/* Focus Flare */}
          <div className={`absolute top-0 right-0 w-64 h-64 bg-zinc-200/50 dark:bg-white/5 blur-[100px] rounded-full transition-opacity duration-1000 ${isFocused ? "opacity-100" : "opacity-0"}`} />
          
          <Avatar className="h-14 w-14 rounded-2xl border border-black/5 dark:border-white/10 shadow-2xl group-hover:rotate-12 transition-transform duration-700">
            {activeChannel ? (
              <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white font-black italic text-xl shadow-inner">{activeChannel.name[0]}</div>
            ) : (
              <><AvatarImage src={user.image} className="object-cover" /><AvatarFallback className="bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white font-black italic">{user.name?.[0]}</AvatarFallback></>
            )}
          </Avatar>
          <div className="flex-1 relative z-10">
            <input
              placeholder="Add a comment..."
              value={newComment}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/5 focus:border-zinc-500 outline-none py-3 text-xl font-bold dark:text-white transition-all placeholder:text-zinc-700 placeholder:italic placeholder:text-xs placeholder:tracking-[0.3em] italic"
            />
            {isFocused && (
              <div className="flex justify-between items-center mt-8 animate-in fade-in slide-in-from-top-2 duration-700">
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 italic bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5">
                      <MapPin className="w-3 h-3 text-zinc-500" /> {cityFetching ? "City..." : userCity}
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 italic bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5">
                      <Activity className="w-3 h-3 text-zinc-500" /> Active
                   </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" onClick={() => { setIsFocused(false); setNewComment(""); }} className="rounded-full h-12 px-8 text-[10px] font-black uppercase tracking-widest italic text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors">Cancel</Button>
                  <Button size="sm" disabled={!newComment.trim() || isSubmitting} onClick={handlePostComment} className="rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 px-12 h-12 text-[10px] font-black uppercase tracking-widest italic shadow-3xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                    <Sparkles className="w-3.5 h-3.5" /> Comment
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-100 dark:bg-zinc-800/40 p-6 rounded-xl text-center mb-8">
           <Button onClick={handlegooglesignin} variant="outline" className="rounded-full">Sign in to comment</Button>
        </div>
      )}

      {/* List */}
      <div className="space-y-8">
        {sortedRoots.map((c) => (
          <CommentItem key={c._id} comment={c} onRefresh={fetchComments} userCity={userCity} setShowErrorModal={setShowErrorModal} />
        ))}
      </div>
    </div>
  );
};

export default Comments;
