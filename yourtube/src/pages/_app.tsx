import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { UserProvider } from "../lib/AuthContext";
import { ContextProvider, useAppStatus } from "@/lib/ContextManager";
import PremiumModal from "@/components/PremiumModal";
import VoIPCallManager from "@/components/VoIPCallManager";
import { useUser } from "@/lib/AuthContext";
import { useRouter } from "next/router";

const AppContent = ({ Component, pageProps }: { Component: any, pageProps: any }) => {
  const { sidebarCollapsed, toggleSidebar, closeSidebar, isCallOpen, closeCallManager } = useAppStatus() as any;
  const { user } = useUser();
  const router = useRouter();
  
  return (
    <div className="h-dvh min-h-dvh w-screen max-w-screen flex flex-col bg-white text-black dark:bg-black dark:text-white transition-colors duration-500 overflow-hidden">
      <Head>
        <title>youtube2.0</title>
      </Head>
      <Header onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 min-h-0 relative">
        <Sidebar collapsed={sidebarCollapsed} onClose={closeSidebar} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Toaster />
          <Component {...pageProps} />
        </main>
      </div>
      <PremiumModal />
      {isCallOpen && (
        <VoIPCallManager
          isOpen={true}
          userName={user?.name || ""}
          onClose={() => {
            closeCallManager();
            if (router.query.room) {
              const { room, ...restQuery } = router.query;
              router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
            }
          }}
        />
      )}
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
