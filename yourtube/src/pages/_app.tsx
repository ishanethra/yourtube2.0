import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { UserProvider } from "../lib/AuthContext";
import { ContextProvider, useAppStatus } from "@/lib/ContextManager";
import PremiumModal from "@/components/PremiumModal";

const AppContent = ({ Component, pageProps }: { Component: any, pageProps: any }) => {
  const { sidebarCollapsed, toggleSidebar } = useAppStatus();
  
  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors duration-500">
      <title>YourTube 2.0</title>
      <Header onToggleSidebar={toggleSidebar} />
      <Toaster />
      <main className="flex">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <Component {...pageProps} />
        </div>
      </main>
      <PremiumModal />
    </div>
  );
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <ContextProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </ContextProvider>
    </UserProvider>
  );
}
