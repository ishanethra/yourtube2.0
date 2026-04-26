import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAppStatus } from "@/lib/ContextManager";

export default function CallsPage() {
  const router = useRouter();
  const { openCallManager } = useAppStatus() as any;

  useEffect(() => {
    openCallManager();
    if (router.query.room) {
      router.replace(`/?room=${router.query.room}`);
    } else {
      router.replace("/");
    }
  }, [router, openCallManager]);

  return (
    <div className="flex-1 p-4 h-full flex items-center justify-center text-zinc-500">
      <p>Loading Call Environment...</p>
    </div>
  );
}
