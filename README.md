# 🎥 YourTube 2.0 — The Ultimate Streaming Ecosystem

[![Deployment Status](https://img.shields.io/badge/Deployment-Live-success?style=for-the-badge&logo=vercel)](https://yourtube-eight.vercel.app/)
[![Tech Stack](https://img.shields.io/badge/Stack-Next.js%20|%20Node.js%20|%20MongoDB-blue?style=for-the-badge)](https://nextjs.org/)
[![Security](https://img.shields.io/badge/Security-Hardened-red?style=for-the-badge)](https://twilio.com/)

**YourTube 2.0** is a premium, context-aware video streaming platform engineered for immersive viewing and secure social interaction. From gesture-controlled playback to real-time VoIP collaboration, it redefines how users consume and interact with content.

---

## 💎 Premium Features Showcase

### 🖖 Gesture Engine 2.0 (Mobile-First)
Experience an app-like feel with advanced touch gestures designed for seamless navigation:
- **Double Tap Right/Left**: Skips playback 10 seconds forward or backward.
- **Single Tap Center**: Instant Pause/Resume functionality.
- **Triple Tap Center**: Automatically skips to the next video in the queue.
- **Triple Tap Right**: Triggers a secure session close (or exit to home).
- **Triple Tap Left**: Instantly opens the collaborative comment section.

### 📶 Collaborative VoIP & Screen Share
Break the barrier of passive viewing with integrated real-time communication:
- **Video Calling**: High-fidelity video calls directly within the app via WebRTC.
- **Shared Viewing**: Synchronized YouTube playback—watch together with friends in real-time.
- **Local Recording**: Record your VoIP sessions and save them directly to your device as `.webm` files.
- **Screen Share**: Broadcast your screen to participants for live discussions.

### 🛡️ Secure Inclusive Commenting
A safe and accessible community environment powered by smart moderation:
- **In-App Translator**: Post in any language and translate comments with a single click.
- **Contextual Origin**: Every comment displays the user's **exact city name** for localized context.
- **Security Block**: Automatic blocking of comments containing restricted characters (`@`, `$`, `#`, `!`, etc.) with a dedicated security alert modal.
- **Auto-Moderation**: Community-driven safety—comments with **2 dislikes** are automatically and permanently removed.

### 🌗 Context-Aware Theme & Auth
The platform adapts dynamically to your environment:
- **Smart Theming**: Automatically applies a **White (Light) Theme** if accessed between 10 AM - 12 PM IST within South India; defaults to **Dark Mode** otherwise.
- **Regional Auth**: Intelligent OTP routing—South Indian users verify via **Email OTP**, while other regions receive **Mobile OTP** via Twilio.

---

## 📈 Tiered Access Model

Our value ladder provides flexible viewing options tailored to every user:

| Plan | Price | Watch Time | Daily Downloads | Benefits |
| :--- | :--- | :--- | :--- | :--- |
| **FREE** | ₹0 | 5 Minutes | 1 Video | Ad-supported, Standard Quality |
| **BRONZE** | ₹10 | 7 Minutes | **Unlimited** | No Ads, Basic Support |
| **SILVER** | ₹50 | 10 Minutes | **Unlimited** | Priority Stream, HD Content |
| **GOLD** | ₹100 | **Unlimited** | **Unlimited** | 4K HDR, VIP Access |

> [!TIP]
> Upon successful payment via **Razorpay**, users receive an automated email invoice containing full transaction details and plan confirmation.

---

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, TailwindCSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js (Express), MongoDB (Mongoose), Socket.io.
- **Security**: Firebase Google Auth, Twilio SMS API, Custom SMTP.
- **Payments**: Razorpay Integration (Test Mode).
- **Geolocation**: Precise GPS (Navigator API) + Nominatim Reverse Geocoding.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account
- Twilio & Razorpay API Keys

### Installation
```bash
# Clone the repository
git clone https://github.com/ishanethra/yourtube2.0.git

# Install Frontend & Backend dependencies
cd yourtube && npm install
cd ../server && npm install

# Configure Environment
# Create .env files in both /yourtube and /server directories
```

### Execution
```bash
# Run Server (Port 5000)
cd server && npm run dev

# Run Frontend (Port 3000)
cd yourtube && npm run dev
```

---

**YourTube 2.0** — Made for the next generation of digital nomads. 🏁🏜️🏁🏁
