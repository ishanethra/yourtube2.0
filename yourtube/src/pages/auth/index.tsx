import React, { useEffect } from "react";
import { useUser } from "@/lib/AuthContext";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { LogIn, Youtube } from "lucide-react";
import Head from "next/head";

const AuthPage = () => {
  const { user, handlegooglesignin, isAuthLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Head>
        <title>Sign In - youtube2.0</title>
      </Head>

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-red-500/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md space-y-8 text-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-2xl">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-500/20 mb-2">
            <Youtube className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            youtube2.0
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Sign in to subscribe to channels, like videos, and save them for later.
          </p>
        </div>

        <div className="pt-4">
          <Button
            onClick={handlegooglesignin}
            disabled={isAuthLoading}
            className="w-full h-14 rounded-2xl bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 dark:border-white/10 dark:bg-white dark:hover:bg-gray-100 font-bold text-lg shadow-xl shadow-gray-200/50 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isAuthLoading ? (
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </>
            )}
          </Button>
        </div>

        <div className="pt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-white/5" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-gray-500 font-black tracking-widest">Premium Experience</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 font-medium px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-sm font-medium">
        &copy; 2026 youtube2.0. All rights reserved.
      </div>
    </div>
  );
};

export default AuthPage;
