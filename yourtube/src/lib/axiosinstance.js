import axios from "axios";
const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://yourtube-backend-024r.onrender.com";

const axiosInstance = axios.create({
  baseURL,
});

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("DEBUG: Backend connected at:", baseURL);
}

export default axiosInstance;
