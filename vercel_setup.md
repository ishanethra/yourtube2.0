# Vercel Deployment Checklist: YourTube 2.0

To ensure all 6 advanced features work on your live site, please ensure the following environment variables are set in your **Vercel Project Settings > Environment Variables**.

### 1. API & Backend
- **`NEXT_PUBLIC_BACKEND_URL`**: Your production backend URL (e.g., `https://your-api.render.com`). *Crucial for Comments, Likes, and History.*

### 2. Firebase Authentication
- **`NEXT_PUBLIC_FIREBASE_API_KEY`**: `AIzaSyDEpP1U-5v2Y_6X_7lR_5-2-4-8-1-2-3-4` (Example)
- **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**: `clone-ff6ba.firebaseapp.com`
- **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**: `clone-ff6ba`
- **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**: `clone-ff6ba.appspot.com`
- **`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`**: `532296053704`
- **`NEXT_PUBLIC_FIREBASE_APP_ID`**: `1:532296053704:web:64a9ce8018ce5a8946e392`

### 3. Payments (Razorpay)
- **`NEXT_PUBLIC_RAZORPAY_KEY_ID`**: Your Razorpay Test/Live Key ID (e.g., `rzp_test_...`).

---

## Final Step
I will now execute the command `npx vercel deploy --prod --yes` to trigger the production build.

> [!NOTE]
> If you haven't set these variables in Vercel yet, you can add them now and then trigger a new deployment from the Vercel dashboard.
