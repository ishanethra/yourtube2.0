import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, createContext, useEffect, useContext, useRef } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

const UserContext = createContext();

const getLocationFromBrowser = async () => {
  const fetchIPAPI = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      return { city: data.city, state: data.region, lat: data.latitude, lon: data.longitude, source: "IP-API" };
    } catch { return null; }
  };

  const fetchIP_API = async () => {
    try {
      // Use HTTPS version of ip-api (requires Pro usually, but we fallback to ipapi.co which is HTTPS)
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      return { city: data.city, state: data.region, lat: data.latitude, lon: data.longitude, source: "IP-API-HTTPS" };
    } catch { return null; }
  };

  const fetchByGeolocation = async () => {
    if (typeof window === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&accept-language=en`);
            const data = await res.json();
            resolve({
              city: data.address.suburb || data.address.neighbourhood || data.address.village || data.address.town || data.address.city,
              state: data.address.state,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              source: "GPS-Nominatim"
            });
          } catch { resolve(null); }
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Precision Optimization: Try GPS first with a short timeout, then fallback to IP
  try {
    const gpsPromise = fetchByGeolocation();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 3500));
    
    // Attempt GPS with 3.5s timeout
    const gpsResult = await Promise.race([gpsPromise, timeoutPromise]);
    if (gpsResult && gpsResult.city !== "Unknown") {
      console.log("DEBUG: Precise GPS Location obtained:", gpsResult.city);
      return gpsResult;
    }
  } catch (e) {
    console.log("DEBUG: GPS timed out or failed, falling back to IP detection.");
  }

  // Fallback to fast IP-based sources
  const fastSources = [fetchIPAPI(), fetchIP_API()];
  try {
    const ipResult = await Promise.any(fastSources.map(p => p.then(res => res || Promise.reject())));
    if (ipResult) {
      console.log("DEBUG: Quick IP Location result obtained:", ipResult.source);
      return ipResult;
    }
  } catch (e) {
    console.log("DEBUG: All location sources failed.");
  }

  return { city: "Unknown", state: "Unknown" };
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const locationRef = useRef(null);

  const login = (userdata) => {
    if (!userdata) return;
    
    // Ensure we extract the base object if it's nested (common with Axios/Mongoose responses)
    const rawData = userdata._doc || userdata.result || userdata;
    
    const sanitizedUser = {
      ...rawData,
      _id: rawData._id || rawData.id || userdata._id || userdata.id,
      name: (rawData?.name && rawData.name !== "undefined") 
        ? rawData.name 
        : (rawData?.channelname || rawData?.email?.split('@')[0] || "User")
    };

    // Sanity check: If we still don't have an _id, we shouldn't save a broken session
    if (!sanitizedUser._id) {
       console.warn("DEBUG: Login attempted with missing _id. Data:", userdata);
    }

    setUser(sanitizedUser);
    localStorage.setItem("user", JSON.stringify(sanitizedUser));
  };

  const refreshUser = async () => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.get(`/user/${user._id}`);
      if (res.data) {
        login(res.data);
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error during sign out:", error);
      toast.error("Error signing out");
    }
  };

  const beginOtpLogin = async (firebaseuser) => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    const locationPromise = locationRef.current || getLocationFromBrowser();
    toast.loading("Getting location & sending OTP...", { id: "auth-loading" });
    
    let location = await locationPromise;
    locationRef.current = null; // Reset for next time

    // Manual Correction Logic for "Exact" requirement
    const confirmation = window.confirm(`Detected location: ${location.city}, ${location.state}. Is this correct?`);
    if (!confirmation) {
      const manualCity = window.prompt("Please enter your exact city/neighborhood manually:");
      if (manualCity) {
        location = { ...location, city: manualCity, state: location.state || "Manual", source: "User-Correction" };
      }
    }
    
    const payload = {
      email: firebaseuser.email?.toLowerCase(),
      name: firebaseuser.displayName,
      image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      city: location.city,
      state: location.state,
    };

    // Ask for OTP preference to ensure flexibility
    const otpPreference = window.confirm("Would you like to receive your OTP via EMAIL? (Click Cancel for Mobile SMS)") ? "email" : "mobile";
    
    let startRes;
    try {
      startRes = await axiosInstance.post("/user/start-login", { ...payload, otpPreference });
      toast.dismiss("auth-loading");
    } catch (error) {
      const requiresMobile =
        error?.response?.data?.message?.toLowerCase()?.includes("mobile") ||
        false;
      if (!requiresMobile) {
        throw error;
      }

      const mobile = window.prompt("Enter mobile number with country code for OTP (example +919876543210)");
      if (!mobile) {
        throw new Error("Mobile number is required for OTP");
      }
      startRes = await axiosInstance.post("/user/start-login", {
        ...payload,
        mobile,
      });
    }

    const otpMode = startRes.data.otpMode;
    if (startRes.data.deliveryFailed && startRes.data.debugOtp) {
      toast.info(`OTP delivery failed. Using test OTP: ${startRes.data.debugOtp}`, { duration: 10000 });
    }
    const otp = window.prompt(
      `Enter the OTP sent to your ${otpMode === "email" ? "email" : "mobile"}`
    );

    if (!otp) {
      setIsAuthLoading(false);
      toast.error("Login cancelled: OTP is required");
      return;
    }

    try {
      const verifyRes = await axiosInstance.post("/user/verify-otp", {
        ...payload,
        email: payload.email?.toLowerCase(),
        mobile: startRes.data?.profilePreview?.mobile,
        otp,
      });

      const userData = verifyRes.data.result;
      login(userData);
      
      const displayName = userData?.name || userData?.channelname || userData?.email?.split('@')[0] || "User";
      toast.success(`Welcome back, ${displayName}`);
      console.log("SUCCESS: User signed in and verified with OTP locally");
    } catch (error) {
      console.error("DEBUG: OTP Login Failed", error);
      const serverMessage = error?.response?.data?.message || "Login failed";
      
      if (error?.response?.status === 404) {
        toast.error("Backend endpoint not found. Ensure server is running at PORT 5000");
      } else {
        toast.error(serverMessage);
      }
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const isProcessingAuthRef = useRef(false);

  useEffect(() => {
    console.log("DEBUG: AuthContext current user state updated:", user);
  }, [user]);

  const handlegooglesignin = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    // Start prefetching location immediately to save time
    locationRef.current = getLocationFromBrowser();
    try {
      // The onAuthStateChanged listener will catch the success and call beginOtpLogin
      await signInWithPopup(auth, provider);
      console.log("DEBUG: Google Sign-in Popup settled");
    } catch (error) {
      setIsAuthLoading(false);
      console.error("DEBUG: Google Sign In Error", error);
      if (error.code === "auth/popup-blocked") {
        toast.error("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (error.code === "auth/cancelled-popup-request") {
        // Silent fail as it's usually handled or a duplicate
      } else {
        toast.error(`Sign-in Error: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Re-run through login logic to sanitize any existing "undefined" strings
      login(parsed);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (!firebaseuser) return;
      
      const existing = localStorage.getItem("user");
      if (existing) {
        console.log("DEBUG: User already logged in locally, skipping OTP");
        return;
      }

      if (isProcessingAuthRef.current) {
        console.log("DEBUG: Auth already in progress, skipping duplicate OTP trigger");
        return;
      }

      try {
        isProcessingAuthRef.current = true;
        console.log("DEBUG: Triggering verified OTP flow for", firebaseuser.email);
        await beginOtpLogin(firebaseuser);
      } catch (error) {
        console.error("DEBUG: OTP Flow Error", error);
      } finally {
        isProcessingAuthRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, refreshUser, handlegooglesignin, isAuthLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
