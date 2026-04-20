import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { useState } from "react";
import { Suspense } from "react";
import { Compass, Sparkles } from "lucide-react";

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <main className="flex-1 p-6 space-y-8 animate-in fade-in duration-1000">
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-3 opacity-40">
            <Compass className="w-4 h-4 text-zinc-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.6em] italic text-zinc-500">Discovery</p>
         </div>
         <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
           Explore <span className="text-zinc-700">Trending</span>
         </h1>
      </div>

      <CategoryTabs
        activeCategory={activeCategory}
        onChange={setActiveCategory}
      />
      
      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-video bg-white/[0.03] rounded-3xl animate-pulse" />
          ))}
        </div>
      }>
        <div className="relative">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
          <Videogrid activeCategory={activeCategory} />
        </div>
      </Suspense>
      
      <div className="mt-20 p-12 rounded-[3.5rem] bg-white/[0.01] border border-white/5 text-center relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
         <Sparkles className="w-8 h-8 text-zinc-800 mx-auto mb-6 group-hover:scale-110 transition-transform duration-700" />
         <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 italic mb-2">More Content Loading</h3>
         <p className="text-xs text-zinc-700 font-bold italic tracking-tight">Sign in to personalize your discovery feed.</p>
      </div>
    </main>
  );
}
