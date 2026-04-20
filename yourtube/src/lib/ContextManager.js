import React, { createContext, useContext, useEffect, useState } from "react";

const ContextManager = createContext({
  theme: "dark",
  locationData: null,
  sidebarCollapsed: false,
  toggleSidebar: () => {}
});

export const ContextProvider = ({ children }) => {
  const [theme, setTheme] = useState("dark");
  const [locationData, setLocationData] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("yourtube_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
        const newState = !prev;
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("yourtube_sidebar_collapsed", String(newState));
        }
        return newState;
    });
  };

  const SOUTH_INDIA_STATES = [
    "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
    "TN", "KL", "KA", "AP", "TS"
  ];

  const applyLightTheme = () => {
    setTheme("light");
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("yourtube_theme", "light");
    }
  };

  const applyDarkTheme = () => {
    setTheme("dark");
    if (typeof window !== "undefined") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("yourtube_theme", "dark");
    }
  };

  const updateTheme = (data = null) => {
    const now = new Date();
    const utcOffset = now.getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 3600000;
    const istDate = new Date(now.getTime() + utcOffset + istOffset);
    const hours = istDate.getHours();
    
    // Strict Operational Rule: Light theme ONLY for South India between 10 AM - 12 PM IST
    const currentState = (data?.region || data?.state || data?.region_name || "").toLowerCase().trim();
    const isSouthIndia = SOUTH_INDIA_STATES.some(s => s.toLowerCase() === currentState);
    const isMorningWindow = hours >= 10 && hours < 12;
    
    const newTheme = (isSouthIndia && isMorningWindow) ? "light" : "dark";
    
    if (data) {
      console.log(`[Theme Engine] Profile: ${data.region || 'External'} | IST Hour: ${hours} | Match: ${newTheme}`);
    }

    if (newTheme === "light") {
      applyLightTheme();
    } else {
      applyDarkTheme();
    }
  };

  const detectContext = async () => {
    updateTheme(null);
    
    if (typeof window !== "undefined" && window.localStorage) {
      const savedLocation = localStorage.getItem("yourtube_location");
      if (savedLocation) {
          const data = JSON.parse(savedLocation);
          setLocationData(data);
          updateTheme(data);
      }
    }

    if (!navigator.geolocation) {
        console.warn("Geolocation not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Use OpenStreetMap Nominatim for precise reverse geocoding with English localization
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          
          const location = {
            city: data.address.city || data.address.town || data.address.village || data.address.suburb || "Local Area",
            state: data.address.state || "",
            country: data.address.country || "",
            latitude,
            longitude
          };
          
          setLocationData(location);
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("yourtube_location", JSON.stringify(location));
          }
          updateTheme(location);
          console.log("DEBUG: Precise Location via GPS (English):", location.city);
        } catch (error) {
          console.error("DEBUG: Precision Sync Error (Falling back to IP):", error);
          // Fallback to IP if Nominatim fails
          fetch("https://ipapi.co/json/", { headers: { "Accept-Language": "en-US" } })
            .then(res => res.json())
            .then(data => {
              setLocationData(data);
              updateTheme(data);
            });
        }
      },
      (error) => {
        console.warn("Geolocation permission denied. Falling back to IP detection.");
        fetch("https://ipapi.co/json/")
          .then(res => res.json())
          .then(data => {
            setLocationData(data);
            updateTheme(data);
          });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectContext();
  }, []);

  useEffect(() => {
    const heartbeat = setInterval(() => updateTheme(locationData), 10000);
    return () => clearInterval(heartbeat);
  }, [locationData]);

  return (
    <ContextManager.Provider value={{ theme, locationData, sidebarCollapsed, toggleSidebar }}>
      {children}
    </ContextManager.Provider>
  );
};

export const useAppStatus = () => useContext(ContextManager);
