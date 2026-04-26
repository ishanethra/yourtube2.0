import { Bell, Menu, Mic, Search, User, VideoIcon } from "lucide-react";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Channeldialogue from "./channeldialogue";
import VoIPCallManager from "./VoIPCallManager";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";

const Header = ({ onToggleSidebar }: { onToggleSidebar: () => void }) => {
  const { user, logout, handlegooglesignin, isAuthLoading } = useUser();
  // const user: any = {
  //   id: "1",
  //   name: "John Doe",
  //   email: "john@example.com",
  //   image: "https://github.com/shadcn.png?height=32&width=32",
  // };
  const [searchQuery, setSearchQuery] = useState("");
  const [isdialogeopen, setisdialogeopen] = useState(false);
  const [isVoipOpen, setIsVoipOpen] = useState(false);
  const router = useRouter();
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  const handleKeypress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as any);
    }
  };
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-2 sm:px-4 bg-white/80 backdrop-blur-md border-b dark:bg-black/80 dark:border-gray-800" style={{ height: "var(--header-height)" }}>
      <div className="flex items-center gap-1 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="shrink-0 text-zinc-900 dark:text-zinc-100">
          <Menu className="w-5 h-5 sm:w-6 h-6" />
        </Button>
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <div className="bg-red-600 p-0.5 sm:p-1 rounded">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="sm:w-6 sm:h-6">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight">youtube2.0</span>
        </Link>
      </div>

      {/* Responsive Search */}
      <form
        onSubmit={handleSearch}
        className="hidden sm:flex items-center gap-2 flex-1 max-w-2xl mx-4"
      >
        <div className="flex flex-1 group">
          <Input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onKeyPress={handleKeypress}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (!val.trim()) router.push("/");
            }}
            className="rounded-l-full border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 border-r-0 focus-visible:ring-1 focus-visible:ring-indigo-500 transition-all h-9 placeholder:text-zinc-400"
          />
          <Button
            type="submit"
            variant="secondary"
            className="rounded-r-full px-5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-gray-300 border border-l-0 border-zinc-300 dark:border-gray-700 h-9"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full bg-gray-50 dark:bg-zinc-900 h-9 w-9 shrink-0">
          <Mic className="w-4 h-4" />
        </Button>
      </form>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mobile Search Trigger */}
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => router.push("/search")}>
          <Search className="w-5 h-5" />
        </Button>
        
        {user ? (
          <>
            <Button variant="ghost" size="icon" className="flex" onClick={() => setIsVoipOpen(true)}>
              <VideoIcon className="w-5 h-5 sm:w-6 h-6" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5 sm:w-6 h-6" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full ring-offset-background hover:ring-2 hover:ring-gray-200 transition-all"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 mt-1 bg-white/95 backdrop-blur-xl dark:bg-zinc-900/95 border-gray-200 dark:border-zinc-800" align="end" forceMount>
                <div className="flex items-center gap-3 p-3 border-b dark:border-zinc-800">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image} />
                    <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-bold text-sm">@{user.name?.replace(/\s+/g, '').toLowerCase() || "user"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                        {user.plan || "FREE"} MEMBER
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-1">
                  {user?.channelname ? (
                    <DropdownMenuItem
                      onClick={() => router.push(`/channel/${user._id || user.id}`)}
                      className="cursor-pointer"
                    >
                      Your channel
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setisdialogeopen(true)}
                      className="cursor-pointer"
                    >
                      Create channel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800" />
                  <DropdownMenuItem onClick={logout} className="text-red-500 cursor-pointer">Sign out</DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-blue-500 text-blue-500 hover:bg-blue-50 font-bold text-xs sm:text-sm px-3 sm:px-4 flex items-center gap-2"
            disabled={isAuthLoading}
            onClick={() => {
              handlegooglesignin?.();
            }}
          >
            {isAuthLoading ? (
               <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <User className="w-4 h-4" />
            )}
            {isAuthLoading ? "Signing in..." : "Sign in"}
          </Button>
        )}
      </div>
      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
      {isVoipOpen && (
        <VoIPCallManager 
          isOpen={isVoipOpen} 
          onClose={() => setIsVoipOpen(false)} 
          userName={user?.name || ""} 
        />
      )}
    </header>
  );
};

export default Header;
