import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { UserProvider } from "../lib/AuthContext";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/AuthContext";

const southStates = [
  "tamil nadu",
  "kerala",
  "karnataka",
  "andhra pradesh",
  "telangana",
];

const ThemeController = () => {
  const { user } = useUser();
  const [detectedState, setDetectedState] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.region) {
          setDetectedState(data.region.toLowerCase());
        }
      } catch (error) {
        console.error("Location detection failed:", error);
      }
    };
    fetchLocation();
  }, []);

  useEffect(() => {
    const now = new Date();
    const istDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const hour = istDate.getHours();
    
    const currentState = (user?.state || detectedState || "").toLowerCase().trim();
    const isSouth = southStates.includes(currentState);
    const shouldUseLight = isSouth && hour >= 10 && hour < 12;

    document.documentElement.classList.toggle("dark", !shouldUseLight);
  }, [user?.state, detectedState]);

  return null;
};

export default function App({ Component, pageProps }: AppProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <UserProvider>
      <ThemeController />
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <title>Your-Tube Clone</title>
        <Header onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)} />
        <Toaster />
        <div className="flex">
          <Sidebar collapsed={sidebarCollapsed} />
          <Component {...pageProps} />
        </div>
      </div>
    </UserProvider>
  );
}
