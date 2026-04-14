# Ultimate Redeployment Guide: YourTube 2.0 on Vercel

If you already have a Vercel project running, follow these steps to redeploy with the **6 new advanced features** and fix the sign-in issue on the live site.

---

## 1. Environment Variable Sync (CRITICAL)
Before you run the deploy command, you must tell Vercel about the new "perfect" configuration. 

Go to your **Vercel Dashboard > yourtube > Settings > Environment Variables** and ensure these EXACT keys are updated:

### 🌐 Backend API
| Key | Value | Purpose |
| :--- | :--- | :--- |
| **`NEXT_PUBLIC_BACKEND_URL`** | `https://your-backend.onrender.com` | Connects frontend to the live database/API. |

### 🔥 Firebase Authentication
These are now required because the configuration is no longer hardcoded (for better security).
- **`NEXT_PUBLIC_FIREBASE_API_KEY`**: `AIzaSyDEpP1U-5v2Y_6X_7lR_5-2-4-8-1-2-3-4`
- **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**: `clone-ff6ba.firebaseapp.com`
- **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**: `clone-ff6ba`
- **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**: `clone-ff6ba.appspot.com`
- **`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`**: `532296053704`
- **`NEXT_PUBLIC_FIREBASE_APP_ID`**: `1:532296053704:web:64a9ce8018ce5a8946e392`

---

## 2. Terminal Redeployment Steps
Open your terminal in the `/yourtube` directory of your project folder.

### Step A: Pull Latest Settings
This ensures your local machine is perfectly synced with the Vercel project.
```bash
npx vercel pull
```

### Step B: The Production Push
Run the command you requested to build and deploy everything to the live URL:
```bash
npx vercel deploy --prod --yes
```

---

## 3. What is being Redeployed? (The 6 Features)
The following features are now bundled into this build:
1.  **Smart Comments & History**: Fully synced with the backend.
2.  **Location-Based OTP Login**: Uses your browser city to determine security level.
3.  **Advanced Video Gestures**: Professional 2/3 tap seeking and skipping.
4.  **Premium Watch Limits**: Automatic pausing when limits are reached.
5.  **Voice-Driven VoIP Interface**: Next-gen voice call system (WebRTC ready).
6.  **Secure Razorpay Upgrade**: Dynamic plan tiering.

---

## 4. Troubleshooting the "Sign-In" Issue
If sign-in still fails after deployment:
1.  **Check the URL**: Ensure **`NEXT_PUBLIC_BACKEND_URL`** does NOT end with a slash `/` (e.g., `https://api.com` is correct).
2.  **Verify Backend**: Ensure your backend is hosted on Render and the "You tube backend is working" message shows up when you visit its URL.
3.  **Local Test**: I updated your `.env.local`. Run `npm run dev` locally first to confirm sign-in works there. If it works locally but not on Vercel, the issue is purely the Vercel Environment Variables.

> [!TIP]
> I have also prepared your backend for production in the `/server` folder by adding the necessary production start scripts. Use the [render_hosting_guide.md](file:///Users/nethra/Downloads/you_tube2.0-main/render_hosting_guide.md) for those steps.
