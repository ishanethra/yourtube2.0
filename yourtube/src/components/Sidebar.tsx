import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  User,
  Download,
  Crown,
  Phone,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";
import { useAppStatus } from "@/lib/ContextManager";
import { useRouter } from "next/router";

const Sidebar = ({ collapsed = false, onClose }: { collapsed?: boolean; onClose?: () => void }) => {
  const { user } = useUser();
  const router = useRouter();
  const { openCallManager } = useAppStatus() as any;

  const [isHovered, setIsHovered] = useState(false);
  const [isdialogeopen, setisdialogeopen] = useState(false);

  const effectiveCollapsed = collapsed && !isHovered;
  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      onClose?.();
    }
  };

  React.useEffect(() => {
    const handleRouteChange = () => handleNavClick();
    router.events?.on("routeChangeComplete", handleRouteChange);
    return () => router.events?.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      {/* Mobile Overlay - Only visible when not collapsed on small screens */}
      {!effectiveCollapsed && (
        <div 
          className="fixed inset-0 bg-white/20 dark:bg-black/40 backdrop-blur-[2px] z-[60] md:hidden transition-opacity duration-300"
          onClick={() => onClose?.()}
        />
      )}
      
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "bg-white border-r p-2 dark:bg-black dark:border-gray-800 transition-all duration-300 ease-in-out z-[70] shadow-2xl shadow-black/5 text-zinc-900 dark:text-zinc-100",
          // Positioning
          // Positioning
          "h-full md:h-[calc(100vh-var(--header-height))] fixed md:sticky top-0 md:top-[var(--header-height)] left-0",
          // Width and Visibility
          effectiveCollapsed 
            ? "w-0 md:w-20 -translate-x-full md:translate-x-0 overflow-hidden opacity-0 md:opacity-100" 
            : "w-64 translate-x-0 opacity-100"
        )}
      >
        <nav className="space-y-0.5 sm:space-y-1">
          <Link href="/">
            <Button
              variant="ghost"
              className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
              title="Home"
              onClick={handleNavClick}
            >
              <Home className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
              {!effectiveCollapsed && "Home"}
            </Button>
          </Link>
          <Link href="/explore">
            <Button
              variant="ghost"
              className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
              title="Explore"
              onClick={handleNavClick}
            >
              <Compass className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
              {!effectiveCollapsed && "Explore"}
            </Button>
          </Link>
          <Link href="/subscriptions">
            <Button
              variant="ghost"
              className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
              title="Subscriptions"
              onClick={handleNavClick}
            >
              <PlaySquare className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
              {!effectiveCollapsed && "Subscriptions"}
            </Button>
          </Link>

          {user && (
            <div className="border-t pt-2 mt-2">
              <Link href="/history">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="History"
                  onClick={handleNavClick}
                >
                  <History className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "History"}
                </Button>
              </Link>
              <Link href="/liked">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Liked videos"
                  onClick={handleNavClick}
                >
                  <ThumbsUp className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Liked videos"}
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Watch later"
                  onClick={handleNavClick}
                >
                  <Clock className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Watch later"}
                </Button>
              </Link>
              <Link href="/downloads">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Downloads"
                  onClick={handleNavClick}
                >
                  <Download className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Downloads"}
                </Button>
              </Link>
              <Link href="/plans">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Upgrade plans"
                  onClick={handleNavClick}
                >
                  <Crown className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Upgrade Plans"}
                </Button>
              </Link>
              <div>
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Video calls"
                  onClick={() => {
                    handleNavClick();
                    openCallManager();
                  }}
                >
                  <Phone className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Video Calls"}
                </Button>
              </div>
              {user?.channelname ? (
                <Link href={`/channel/${user._id || user.id}`}>
                  <Button
                    variant="ghost"
                    className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                    title="Your channel"
                    onClick={handleNavClick}
                  >
                    <User className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                    {!effectiveCollapsed && "Your channel"}
                  </Button>
                </Link>
              ) : (
                <div className={`px-2 py-1.5 ${effectiveCollapsed ? "hidden" : ""}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() => setisdialogeopen(true)}
                  >
                    Create Channel
                  </Button>
                </div>
              )}
            </div>
          )}
        </nav>
        <Channeldialogue
          isopen={isdialogeopen}
          onclose={() => setisdialogeopen(false)}
          mode="create"
        />
      </aside>
    </>
  );
};

export default Sidebar;
