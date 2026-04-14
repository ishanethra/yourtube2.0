# How to Host Your Backend on Render

Since your frontend is on Vercel, your backend needs a live URL to handle the database, authentication (OTP), and payments.

### Step 1: Push your code to GitHub
Make sure the `/server` folder is pushed to your GitHub repository.

### Step 2: Create a Web Service on Render
1.  Log in to [Render](https://render.com).
2.  Click **New +** > **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings**:
    - **Build Command**: `npm install`
    - **Start Command**: `npm start`
    - **Root Directory**: `server`

### Step 3: Configure Environment Variables
In the Render Web Service settings, go to **Environment** and add the following keys:

| Key | Description |
| :--- | :--- |
| **`DB_URL`** | Your MongoDB connection string. |
| **`OTP_SECRET`** | A random string for OTP signing. |
| **`SMTP_EMAIL`** | The email address used to send OTPs. |
| **`SMTP_PASSWORD`** | The App Password for the email (e.g., Gmail App Password). |
| **`RAZORPAY_KEY_ID`** | Your Razorpay Key ID. |
| **`RAZORPAY_KEY_SECRET`** | Your Razorpay Key Secret. |
| **`TWILIO_ACCOUNT_SID`** | (Optional) For SMS OTP. |
| **`TWILIO_AUTH_TOKEN`** | (Optional) For SMS OTP. |
| **`TWILIO_PHONE_NUMBER`** | (Optional) For SMS OTP. |

### Step 4: Link your Frontend
Once Render gives you a URL (e.g., `https://your-api.onrender.com`):
1.  Go to your **Vercel Dashboard**.
2.  Update the **`NEXT_PUBLIC_BACKEND_URL`** environment variable with this new URL.
3.  Re-deploy the frontend!

> [!NOTE]
> Since this is a free Render service, the backend will "sleep" after 15 minutes of inactivity. It will take ~30 seconds to wake up whenever you first open the site.
