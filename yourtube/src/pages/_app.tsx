import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { UserProvider } from "../lib/AuthContext";
import { ContextProvider, useAppStatus } from "@/lib/ContextManager";
import PremiumModal from "@/components/PremiumModal";

const AppContent = ({ Component, pageProps }: { Component: any, pageProps: any }) => {
  const { sidebarCollapsed, toggleSidebar, closeSidebar } = useAppStatus() as any;
  
  return (
    <div className="h-dvh min-h-dvh w-screen max-w-screen flex flex-col bg-white text-black dark:bg-black dark:text-white transition-colors duration-500 overflow-hidden">
      <title>youtube2.0</title>
      <Header onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 min-h-0 relative">
        <Sidebar collapsed={sidebarCollapsed} onClose={closeSidebar} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Toaster />
          <Component {...pageProps} />
        </main>
      </div>
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
