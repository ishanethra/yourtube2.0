import { onAuthStateChanged, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
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
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 800));
    
    // Attempt GPS with 2s timeout for snappier experience
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
  const [authPrompt, setAuthPrompt] = useState({
    open: false,
    title: "",
    message: "",
    placeholder: "",
    type: "text",
    submitLabel: "Submit",
    value: "",
  });
  const promptResolverRef = useRef(null);

  const requestAuthInput = ({ title, message, placeholder, type = "text", submitLabel = "Continue" }) =>
    new Promise((resolve) => {
      promptResolverRef.current = resolve;
      setAuthPrompt({
        open: true,
        title,
        message,
        placeholder,
        type,
        submitLabel,
        value: "",
      });
    });

  const closeAuthPrompt = (value = "") => {
    if (promptResolverRef.current) {
      promptResolverRef.current(value);
      promptResolverRef.current = null;
    }
    setAuthPrompt((prev) => ({ ...prev, open: false, value: "" }));
  };

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
    
    // Precision-first: always attempt GPS/IP resolution before OTP routing.
    toast.loading("Gearing up...", { id: "auth-loading" });
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ city: "Unknown", state: "Unknown" }), 5000)
    );
    let location = await Promise.race([locationPromise, timeoutPromise]);

    // If active lookup is still unknown, use last precise location cached by ContextManager.
    if ((!location?.state || location.state === "Unknown") && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("yourtube_location");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.state) {
            location = {
              city: parsed.city || location.city || "Unknown",
              state: parsed.state || location.state || "Unknown",
            };
          }
        }
      } catch (_) { /* no-op */ }
    }
    
    locationRef.current = null;

    const payload = {
      email: firebaseuser.email?.toLowerCase(),
      name: firebaseuser.displayName,
      image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      city: location.city,
      state: location.state,
    };

    console.log(`DEBUG: Final Auth Payload -> Email: ${payload.email} | State: ${payload.state} | City: ${payload.city}`);

    let startRes;
    try {
      startRes = await axiosInstance.post("/user/start-login", payload);
      toast.dismiss("auth-loading");
    } catch (error) {
      throw error;
    }

    const otpMode = startRes.data.otpMode;
    if (otpMode === "mobile") {
      const mobile = await requestAuthInput({
        title: "Mobile Verification",
        message: "Enter mobile number with country code (example +919876543210)",
        placeholder: "+919876543210",
        type: "tel",
        submitLabel: "Send OTP",
      });
      if (!mobile) {
        setIsAuthLoading(false);
        toast.error("Mobile number is required");
        return;
      }

      try {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
          });
        }
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, mobile, appVerifier);
        const mobileOtp = await requestAuthInput({
          title: "Enter OTP",
          message: "Enter the OTP sent to your mobile number",
          placeholder: "6-digit OTP",
          type: "text",
          submitLabel: "Verify OTP",
        });
        if (!mobileOtp) {
          setIsAuthLoading(false);
          toast.error("Login cancelled: OTP is required");
          return;
        }

        await confirmationResult.confirm(mobileOtp);
        const verifyRes = await axiosInstance.post("/user/mobile-login", {
          ...payload,
          mobile,
        });
        const userData = verifyRes.data.result;
        login(userData);
        const displayName = userData?.name || userData?.channelname || userData?.email?.split("@")[0] || "User";
        toast.success(`Welcome back, ${displayName}`);
      } catch (error) {
        console.error("Firebase mobile OTP login failed", error);
        toast.error(error?.message || "Mobile OTP verification failed");
        throw error;
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    if (startRes.data.deliveryFailed && startRes.data.debugOtp) {
      toast.info(`OTP delivery failed. Using test OTP: ${startRes.data.debugOtp}`, { duration: 10000 });
    } else if (otpMode === "email") {
      toast.success("OTP sent to your email! Please check your Inbox and Spam folder.", { duration: 8000 });
    }
    
    // Developer Fallback: Only log for the primary owner to ensure you are never blocked
    if (firebaseuser.email?.toLowerCase().trim() === "nethra2257@gmail.com") {
      console.log("-----------------------------------------");
      console.log("YourTube 2.0 - SECURITY OTP:", startRes.data.debugOtp || "Sent via Service");
      console.log("-----------------------------------------");
    }

    const otp = await requestAuthInput({
      title: "Enter OTP",
      message: `Enter the OTP sent to your ${otpMode === "email" ? "email" : "mobile"}. Check SPAM folder if not received.`,
      placeholder: "6-digit OTP",
      type: "text",
      submitLabel: "Verify OTP",
    });

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
      // Force account-chooser behavior on every explicit sign-in click.
      // This prevents automatic reuse of a background Firebase session.
      try {
        await signOut(auth);
      } catch (_) {
        // No active session to clear; continue.
      }
      provider.setCustomParameters({
        prompt: "select_account",
      });
      const result = await signInWithPopup(auth, provider);
      console.log("DEBUG: Google Sign-in Popup settled. Triggering OTP flow...");
      if (result.user) {
        await beginOtpLogin(result.user);
      }
    } catch (error) {
      console.error("DEBUG: Google Sign In Error", error);
      if (error.code === "auth/popup-blocked") {
        toast.error("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (error.code === "auth/cancelled-popup-request") {
        // Silent fail as it's usually handled or a duplicate
      } else {
        toast.error(`Sign-in Error: ${error.message}`);
      }
      setIsAuthLoading(false);
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
        // User is already logged into our app session
        return;
      }

      // v2.0 Change: Do not automatically trigger OTP flow on background session detection.
      // This allows guests to browse freely without being interrupted by popups.
      // The user must explicitly click "Sign In" to start the beginOtpLogin flow.
      console.log("DEBUG: Background Firebase session found for", firebaseuser.email, "- Waiting for explicit sign-in.");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (promptResolverRef.current) {
        promptResolverRef.current("");
        promptResolverRef.current = null;
      }
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, refreshUser, handlegooglesignin, isAuthLoading }}>
      <div id="recaptcha-container"></div>
      {authPrompt.open && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{authPrompt.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{authPrompt.message}</p>
            <input
              autoFocus
              type={authPrompt.type}
              value={authPrompt.value}
              onChange={(e) => setAuthPrompt((prev) => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") closeAuthPrompt(authPrompt.value.trim());
              }}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={authPrompt.placeholder}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeAuthPrompt("")}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeAuthPrompt(authPrompt.value.trim())}
                className="rounded-xl px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
              >
                {authPrompt.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
