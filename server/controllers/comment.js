import comment from "../Modals/comment.js";
import mongoose from "mongoose";

// Block special characters while allowing letters from major world scripts and basic punctuation
// Liberal regex allowing letters from major world scripts, punctuation, and common symbols/emojis
// Strict special character moderation: Allow only Alphanumeric, common punctuation, spaces, and emojis.
// Block symbols used for scripting, formatting, or spam: < > { } [ ] \ / | ~ ^ * + =
const STRICT_BLOCK_REGEX = /[<>{}\[\]\\\/|~^\*+=]/;
const IS_DANGEROUS = (text) => STRICT_BLOCK_REGEX.test(text) || /<script|javascript:|data:/i.test(text);

const LANG_NAMES = {
  en:"English", hi:"Hindi", ta:"Tamil", te:"Telugu", kn:"Kannada",
  ml:"Malayalam", fr:"French", es:"Spanish", de:"German", zh:"Chinese",
  ar:"Arabic", ja:"Japanese", ru:"Russian", pt:"Portuguese", it:"Italian",
  ko:"Korean", bn:"Bengali", gu:"Gujarati", mr:"Marathi", pa:"Punjabi",
  ur:"Urdu", tr:"Turkish", vi:"Vietnamese", th:"Thai", id:"Indonesian",
};

// ── Language detection (MyMemory free API, no key) ───────────────────────────
async function detectLanguage(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 100))}&langpair=auto|en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("detect failed");
    const data = await res.json();
    const detected = data?.responseData?.detectedLanguage?.split("-")[0]?.toLowerCase();
    if (detected && LANG_NAMES[detected]) {
      return { code: detected, name: LANG_NAMES[detected] };
    }
  } catch (_) { /* silent */ }

  // Fallback: Google Translate public endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 100))}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const code = data?.[2];
      if (code && LANG_NAMES[code]) return { code, name: LANG_NAMES[code] };
    }
  } catch (_) { /* silent */ }

  return { code: "en", name: "English" };
}

// ── Translation (MyMemory free API with LibreTranslate fallback) ─────────────
async function translateText(text, sourceLang, targetLang) {
  if (sourceLang === targetLang) return text;
  try {
    const langpair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("translate failed");
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && translated !== "NO QUERY SPECIFIED") return translated;
    throw new Error("empty");
  } catch (_) { /* try fallback */ }

  // Fallback: LibreTranslate public instance
  try {
    const ltRes = await fetch("https://translate.fedilab.app/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: "text" }),
    });
    if (ltRes.ok) {
      const ltData = await ltRes.json();
      if (ltData?.translatedText) return ltData.translatedText;
    }
  } catch (_) { /* both services failed */ }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export const postcomment = async (req, res) => {
  const { videoid, userid, commentbody, usercommented, city, userimage, parentCommentId } = req.body;

  if (!videoid || !userid || !commentbody?.trim()) {
    return res.status(400).json({ message: "Required fields (videoid, userid, or body) are missing." });
  }

  if (IS_DANGEROUS(commentbody)) {
    return res.status(400).json({ message: "Comment contains restricted special characters or scripts. Please use standard text." });
  }

  const { code: langCode, name: langName } = await detectLanguage(commentbody);

  try {
    const newComment = new comment({
      videoid,
      userid,
      commentbody,
      usercommented,
      userimage,
      city: city || "Unknown",
      language: langCode,
      languageName: langName,
      // Legacy field kept for backward compatibility
      detectedLang: langCode,
      parentCommentId: parentCommentId || null,
    });
    await newComment.save();
    console.log(`Comment saved. Detected language: ${langName}`);
    return res.status(200).json({ data: newComment, comment: true, detectedLanguage: langName });
  } catch (error) {
    console.error("postcomment error:", error);
    return res.status(500).json({ message: `Database error: ${error.message}` });
  }
};

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  try {
    const comments = await comment.find({ videoid }).sort({ createdAt: -1 });
    return res.status(200).json(comments);
  } catch (error) {
    console.error("getallcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deletecomment = async (req, res) => {
  const { id } = req.params;
  try {
    await comment.findByIdAndDelete(id);
    // Cascade Delete: remove all replies to this comment
    await comment.deleteMany({ parentCommentId: id });
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error("deletecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editcomment = async (req, res) => {
  const { id } = req.params;
  const { commentbody } = req.body;

  if (!commentbody?.trim() || STRICT_BLOCK_REGEX.test(commentbody)) {
    return res.status(400).json({ message: "Comment contains blocked special characters." });
  }

  try {
    // Re-detect language on edit
    const { code: langCode, name: langName } = await detectLanguage(commentbody);
    const updatedComment = await comment.findByIdAndUpdate(
      id,
      { $set: { commentbody, language: langCode, languageName: langName, detectedLang: langCode } },
      { new: true }
    );
    return res.status(200).json(updatedComment);
  } catch (error) {
    console.error("editcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Unified vote handler — auto-removes comment at 2 dislikes (includes cascading delete)
export const votecomment = async (req, res) => {
  const { id } = req.params;
  const { userId, voteType } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: "Comment not found" });

  try {
    const commentDoc = await comment.findById(id);
    if (!commentDoc) return res.status(404).json({ message: "Comment not found" });

    const uid = new mongoose.Types.ObjectId(userId);
    const liked    = commentDoc.likedBy.some(x => x.equals(uid));
    const disliked = commentDoc.dislikedBy.some(x => x.equals(uid));

    if (voteType === "like") {
      if (liked) {
        await comment.findByIdAndUpdate(id, { $pull: { likedBy: uid }, $inc: { likeCount: -1 } });
      } else {
        const u = { $addToSet: { likedBy: uid }, $inc: { likeCount: 1 } };
        if (disliked) { u.$pull = { dislikedBy: uid }; u.$inc.dislikeCount = -1; }
        await comment.findByIdAndUpdate(id, u);
      }
    } else if (voteType === "dislike") {
      if (disliked) {
        await comment.findByIdAndUpdate(id, { $pull: { dislikedBy: uid }, $inc: { dislikeCount: -1 } });
      } else {
        const u = { $addToSet: { dislikedBy: uid }, $inc: { dislikeCount: 1 } };
        if (liked) { u.$pull = { likedBy: uid }; u.$inc.likeCount = -1; }
        await comment.findByIdAndUpdate(id, u);
      }
    }

    // Auto-remove when dislikeCount reaches 2
    const updated = await comment.findById(id);
    if (updated && updated.dislikeCount >= 2) {
      await comment.findByIdAndDelete(id);
      // Cascade delete replies if the parent is removed via moderation
      await comment.deleteMany({ parentCommentId: id });
      return res.status(200).json({ removed: true, message: "Comment removed due to 2 dislikes." });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("votecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Legacy handlers kept so old frontend calls still work
export const likecomment = async (req, res) => {
  req.body.voteType = "like";
  return votecomment(req, res);
};

export const dislikecomment = async (req, res) => {
  req.body.voteType = "dislike";
  return votecomment(req, res);
};

// GET /comment/:id/translate/:lang — translate a specific comment using stored source language
export const translatecomment = async (req, res) => {
  const { id } = req.params;
  const { to: targetLang } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: "Comment not found" });

  try {
    const commentDoc = await comment.findById(id);
    if (!commentDoc) return res.status(404).json({ message: "Comment not found" });

    const sourceLangStored = commentDoc.language || commentDoc.detectedLang || "en";

    // Professional move: Use 'auto' as the source for the actual translation service
    // to handle Tanglish/Hinglish better than our initial detection might have.
    const translated = await translateText(commentDoc.commentbody, "auto", targetLang);

    if (!translated) {
      return res.status(503).json({ message: "Translation service unavailable. Try again shortly." });
    }

    return res.status(200).json({
      original:   commentDoc.commentbody,
      translated,
      sourceLang: sourceLangStored,
      sourceName: commentDoc.languageName || LANG_NAMES[sourceLangStored] || sourceLangStored,
      targetLang,
      targetName: LANG_NAMES[targetLang] || targetLang,
    });
  } catch (error) {
    console.error("translatecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
