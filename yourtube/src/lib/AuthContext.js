import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, createContext, useEffect, useContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";

const UserContext = createContext();

const getLocationFromBrowser = async () => {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return { city: "Unknown", state: "Unknown" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
          );
          const data = await response.json();
          const city =
            data?.address?.city ||
            data?.address?.town ||
            data?.address?.village ||
            "Unknown";
          const state = data?.address?.state || "Unknown";
          resolve({ city, state });
        } catch (error) {
          resolve({ city: "Unknown", state: "Unknown" });
        }
      },
      () => resolve({ city: "Unknown", state: "Unknown" }),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (userdata) => {
    setUser(userdata);
    localStorage.setItem("user", JSON.stringify(userdata));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  const beginOtpLogin = async (firebaseuser) => {
    const location = await getLocationFromBrowser();
    const payload = {
      email: firebaseuser.email,
      name: firebaseuser.displayName,
      image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      city: location.city,
      state: location.state,
    };

    let startRes;
    try {
      startRes = await axiosInstance.post("/user/start-login", payload);
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
      window.alert(`OTP delivery failed. Use this test OTP: ${startRes.data.debugOtp}`);
    }
    const otp = window.prompt(
      `Enter the OTP sent to your ${otpMode === "email" ? "email" : "mobile"}`
    );

    if (!otp) {
      throw new Error("OTP is required");
    }

    const verifyRes = await axiosInstance.post("/user/verify-otp", {
      ...payload,
      mobile: startRes.data?.profilePreview?.mobile,
      otp,
    });

    login(verifyRes.data.result);
  };

  const handlegooglesignin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;
      await beginOtpLogin(firebaseuser);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }

    const unsubcribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (!firebaseuser) return;
      const existing = localStorage.getItem("user");
      if (existing) return;
      try {
        await beginOtpLogin(firebaseuser);
      } catch (error) {
        console.error(error);
      }
    });

    return () => unsubcribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, handlegooglesignin }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
