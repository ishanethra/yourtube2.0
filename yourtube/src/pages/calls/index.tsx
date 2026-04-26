import { useRouter } from "next/router";
import { useEffect } from "react";
import VoIPCallManager from "@/components/VoIPCallManager";
import { useUser } from "@/lib/AuthContext";

export default function CallsPage() {
  const router = useRouter();
  const { user } = useUser();

  useEffect(() => {
    if (!router.query.room) return;
    // Keep room code normalized in URL for consistent join behavior.
    const room = String(router.query.room).toUpperCase();
    if (room !== router.query.room) {
      router.replace({ pathname: "/calls", query: { ...router.query, room } }, undefined, { shallow: true });
    }
  }, [router]);

  return (
    <VoIPCallManager
      isOpen={true}
      userName={user?.name || ""}
      onClose={() => {
        router.push("/");
      }}
    />
  );
}
