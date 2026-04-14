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
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";

const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { user } = useUser();

  const [isdialogeopen, setisdialogeopen] = useState(false);
  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } bg-white border-r min-h-screen p-2 dark:bg-black dark:border-gray-800 transition-all duration-200`}
    >
      <nav className="space-y-1">
        <Link href="/">
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
            title="Home"
          >
            <Home className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
            {!collapsed && "Home"}
          </Button>
        </Link>
        <Link href="/explore">
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
            title="Explore"
          >
            <Compass className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
            {!collapsed && "Explore"}
          </Button>
        </Link>
        <Link href="/subscriptions">
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
            title="Subscriptions"
          >
            <PlaySquare className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
            {!collapsed && "Subscriptions"}
          </Button>
        </Link>

        {user && (
          <>
            <div className="border-t pt-2 mt-2">
              <Link href="/history">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="History"
                >
                  <History className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "History"}
                </Button>
              </Link>
              <Link href="/liked">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="Liked videos"
                >
                  <ThumbsUp className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "Liked videos"}
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="Watch later"
                >
                  <Clock className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "Watch later"}
                </Button>
              </Link>
              <Link href="/downloads">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="Downloads"
                >
                  <Download className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "Downloads"}
                </Button>
              </Link>
              <Link href="/plans">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="Upgrade plans"
                >
                  <Crown className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "Upgrade Plans"}
                </Button>
              </Link>
              <Link href="/calls">
                <Button
                  variant="ghost"
                  className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                  title="Video calls"
                >
                  <Phone className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                  {!collapsed && "Video Calls"}
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user.id}`}>
                  <Button
                    variant="ghost"
                    className={`w-full ${collapsed ? "justify-center" : "justify-start"}`}
                    title="Your channel"
                  >
                    <User className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                    {!collapsed && "Your channel"}
                  </Button>
                </Link>
              ) : (
                <div className={`px-2 py-1.5 ${collapsed ? "hidden" : ""}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setisdialogeopen(true)}
                  >
                    Create Channel
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </nav>
      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </aside>
  );
};

export default Sidebar;
