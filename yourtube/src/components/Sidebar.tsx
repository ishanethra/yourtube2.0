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

const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { user } = useUser();

  const [isHovered, setIsHovered] = useState(false);
  const [isdialogeopen, setisdialogeopen] = useState(false);

  const effectiveCollapsed = collapsed && !isHovered;
  return (
    <>
      {/* Mobile Overlay - Only visible when not collapsed on small screens */}
      {!effectiveCollapsed && (
        <div 
          className="fixed inset-0 bg-white/20 dark:bg-black/40 backdrop-blur-[2px] z-[60] md:hidden transition-opacity duration-300"
          onClick={() => {}} // Integration with toggle in _app will manage this
        />
      )}
      
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "bg-white border-r p-2 dark:bg-black dark:border-gray-800 transition-all duration-300 ease-in-out z-[70] shadow-2xl shadow-black/5 text-zinc-900 dark:text-zinc-100",
          // Positioning
          "h-screen md:h-[calc(100vh-56px)] fixed md:sticky top-0 md:top-[56px] left-0",
          // Width and Visibility
          effectiveCollapsed 
            ? "w-0 md:w-20 -translate-x-full md:translate-x-0 overflow-hidden opacity-0 md:opacity-100" 
            : "w-64 translate-x-0 opacity-100"
        )}
      >
        <nav className="space-y-1">
          <Link href="/">
            <Button
              variant="ghost"
              className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
              title="Home"
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
                >
                  <Crown className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Upgrade Plans"}
                </Button>
              </Link>
              <Link href="/calls">
                <Button
                  variant="ghost"
                  className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                  title="Video calls"
                >
                  <Phone className={`w-5 h-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
                  {!effectiveCollapsed && "Video Calls"}
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user.id}`}>
                  <Button
                    variant="ghost"
                    className={`w-full ${effectiveCollapsed ? "justify-center" : "justify-start"}`}
                    title="Your channel"
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
