import React from "react";
import { ExternalLink, Info, Star } from "lucide-react";

const AdCard = () => {
  return (
    <div className="group relative flex flex-col bg-zinc-100 dark:bg-white/[0.03] rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 transition-all duration-500 hover:shadow-2xl">
      <div className="relative aspect-video">
        <img 
          src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop" 
          alt="Advertisement"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-300">Sponsored</span>
          <Info className="w-2.5 h-2.5 text-zinc-500" />
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-black dark:text-white line-clamp-1 italic tracking-tight">youtube2.0 Creator Awards 2026</h3>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Join the global event</p>
          </div>
          <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
            <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
            <span className="text-[9px] font-bold text-yellow-500">4.9</span>
          </div>
        </div>
        
        <button className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 group/btn">
          Visit Site
          <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </button>
      </div>
      
      {/* Background ambience for the card */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
};

export default AdCard;
