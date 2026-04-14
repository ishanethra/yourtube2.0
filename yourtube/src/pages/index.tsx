import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { useState } from "react";
import { Suspense } from "react";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <main className="flex-1 p-4">
      <CategoryTabs
        activeCategory={activeCategory}
        onChange={setActiveCategory}
      />
      <Suspense fallback={<div>Loading videos...</div>}>
        <Videogrid activeCategory={activeCategory} />
      </Suspense>
    </main>
  );
}
