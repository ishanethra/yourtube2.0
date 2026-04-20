import React from "react";
import { PlaySquare, BellOff } from "lucide-react";

export default function SubscriptionsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-6">
      <div className="p-6 rounded-full bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
        <PlaySquare className="w-16 h-16 text-gray-400" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Your Subscriptions</h1>
        <p className="text-gray-500 dark:text-gray-400">
          This is where videos from the channels you subscribe to will appear. 
          Subscribe to some channels to get started!
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400 border border-dashed p-4 rounded-xl">
        <BellOff className="w-4 h-4" />
        Feature currently in development
      </div>
    </div>
  );
}
