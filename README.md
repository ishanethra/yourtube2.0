# YourTube 2.0 — The Ultimate Streaming Experience

**Live Demo: [yourtube-eight.vercel.app](https://yourtube-eight.vercel.app/)**

YourTube 2.0 is a premium, secure, and context-aware video streaming platform designed for modern consumers. Built with a focus on immersive interaction and robust security, it redefines the standard for community-driven content.

## 🚀 Vision
To provide a seamless, premium alternative to traditional video platforms, featuring gesture-driven controls and inclusive, moderated social interaction.

---

## ✨ Key Features

### 📡 Collaborative VoIP & Multi-Stream
- **Two-Way Video/Audio**: Real-time collaboration via high-fidelity VoIP.
- **Screen Sharing**: Effortlessly share your screen with collaborators.
- **Direct Recording**: Record sessions and download directly as high-quality `.webm` files.

### 🖖 Gesture Engine 2.0
- **Single Tap**: Instant Play/Pause.
- **Double Tap**: 
  - Left/Right: High-speed Seek (10s).
  - Center: Cinema Mode (Fullscreen).
- **Triple Tap**: 
  - Left: Auto-scroll to Comments.
  - Center: Next Video.
  - Right: Quick Exit.

### 🔒 Hardened Security & Inclusive Comments
- **Multilingual Support**: Community input in any language (Tamil, Hindi, French, etc.).
- **Contextual Transparency**: User city/suburb tags appear beside usernames.
- **Security Modal Alert**: Real-time block of special characters (`@`, `$`, `#`, `!`) with a clear, high-contrast popup.
- **Auto-Moderation**: Community-driven suppression of disruptive content (2-dislike auto-hide).
- **In-App Translation**: Integrated globe-icon translation to bridge language gaps.

### 🌗 Dynamic Context Engine
- **Region-Aware Auth**: Smart OTP delivery—Email OTP for South India, Mobile OTP for other regions.
- **Operational Themes**: Automated Light Theme window (10 AM - 12 PM IST) for South India; Sleek Dark Mode elsewhere.

### 💳 Tiered Premium Ecosystem
- **Instant Upgrades**: Seamless Razorpay integration for Bronze, Silver, and Gold tiers.
- **Tiered Permissions**: 
  - **Bronze**: 7-min daily limit, unlimited downloads.
  - **Silver**: 10-min daily limit, priority streaming.
  - **Gold**: Unlimited everything.
- **Smart Enforcement**: Automatic playback pause and redirection when limits are reached.

---

## 🛠️ Technical Stack
- **Frontend**: Next.js, TailwindCSS (Zinc Palette), Lucide icons.
- **Backend**: Node.js, Express, MongoDB.
- **Communications**: Twilio (OTP), Razorpay (Billing), VoIP (WebRTC).
- **State**: Precise Location (GPS/Nominatim), Firebase Auth.

---

## 🏗️ Getting Started

### 1. Environment Setup
Create a `.env` in the root with:
```env
# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token

# Razorpay
RAZORPAY_KEY_ID=your_id
RAZORPAY_KEY_SECRET=your_secret

# MongoDB
MONGO_URL=your_mongo_url
```

### 2. Launch
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📜 Project Rules
- **Standard Text Only**: Symbols like `@`, `$`, and `!` are restricted from comments to ensure readable, spam-free discourse.
- **City Privacy**: By participating, users agree to the display of their suburb/city name to foster localized community trust.

---
**YourTube 2.0** — Made for the next generation of creators. 🏁🏜️🏁🏁
