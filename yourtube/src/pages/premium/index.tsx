import React, { useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";
import { startRazorpayPayment } from "@/lib/payment";
import axiosInstance from "@/lib/axiosinstance";
import { Button } from "@/components/ui/button";
import { Check, Crown, Zap, Shield, Star, Rocket, Play, Download, Verified } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    name: "Free",
    id: "FREE",
    price: 0,
    time: "5 Min",
    downloads: "1/Day",
    features: ["Standard Quality", "Ads Supported", "Community Access"],
    icon: Star,
    color: "bg-zinc-900/50",
    accent: "text-zinc-400",
    border: "border-zinc-800",
  },
  {
    name: "Bronze",
    id: "BRONZE",
    price: 10,
    time: "7 Min",
    downloads: "Unlimited",
    features: ["No Ads", "Basic Support", "HD+ Streaming"],
    icon: Zap,
    color: "bg-white/5",
    accent: "text-zinc-200",
    border: "border-white/10",
  },
  {
    name: "Silver",
    id: "SILVER",
    price: 50,
    time: "10 Min",
    downloads: "Unlimited",
    features: ["No Ads", "Priority Support", "Full HD Experience"],
    icon: Shield,
    color: "bg-white/10",
    accent: "text-white",
    border: "border-white/20",
  },
  {
    name: "Gold",
    id: "GOLD",
    price: 100,
    time: "Unlimited",
    downloads: "Unlimited",
    features: ["Cinematic 4K", "Concierge Support", "Global Library"],
    icon: Crown,
    color: "bg-yellow-500/10",
    accent: "text-yellow-500",
    border: "border-yellow-500/30",
  },
];

const PLAN_RANK: Record<string, number> = { FREE: 0, BRONZE: 1, SILVER: 2, GOLD: 3 };

export default function PremiumStore() {
  const router = useRouter();
  const { user, login, refreshUser } = useUser();
  const [loading, setLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const userRank = PLAN_RANK[(user?.plan || "FREE").toUpperCase()] ?? 0;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubscription = async (plan: any) => {
    if (!user) {
      toast.error("Authentication required to access Premium Store.");
      return;
    }
    if (plan.price === 0) {
        toast.info("Free membership active.");
        return;
    }

    const normalizedPlan = plan.id.toUpperCase();
    setLoading(plan.id);
    try {
      await startRazorpayPayment({
        user,
        plan: normalizedPlan,
        purpose: "plan",
        onSuccess: (updatedUser) => {
          login(updatedUser);
          const from = router.query.from as string;
          if (from) {
            router.push(from);
          } else {
            window.location.reload();
          }
        },
      });
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.message || error.message || "Checkout unavailable";
      toast.error(`Checkout Failed: ${errorMsg}`);
    } finally {
      setLoading(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/30 selection:text-white overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/[0.02] blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-500/5 blur-[150px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-20 space-y-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 opacity-40">
             <Rocket className="w-5 h-5 text-white" />
             <p className="text-[10px] font-black uppercase tracking-[0.6em] italic text-zinc-500">Premium Membership</p>
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
            Unlock <span className="text-zinc-800">Premium</span>
          </h1>
          <p className="max-w-xl text-zinc-500 font-bold italic text-lg leading-relaxed mx-auto md:mx-0">
            Enjoy unlimited viewing and direct library downloads. 
            Select your membership level below.
          </p>
        </div>

        {/* Plan Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
          {PLANS.map((plan) => {
            const planRank = PLAN_RANK[plan.id] ?? 0;
            const isCurrent = (user?.plan || "FREE").toUpperCase() === plan.id.toUpperCase();
            const isLower = planRank < userRank;
            const isHigher = planRank > userRank;
            const PlanIcon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`group relative flex flex-col p-10 rounded-[3rem] bg-white/[0.01] border transition-all duration-700 ${
                  isCurrent 
                    ? "border-white/40 bg-white/[0.04] ring-1 ring-white/10" 
                    : isLower
                    ? `${plan.border} opacity-50`
                    : `${plan.border} hover:bg-white/[0.03] hover:scale-[1.02] hover:shadow-3xl`
                }`}
              >
                {/* Current Badge */}
                {isCurrent && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black italic px-6 py-2 rounded-full uppercase tracking-widest shadow-xl">
                    ✓ Current Plan
                  </div>
                )}

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 bg-black border border-white/5 shadow-2x transition-transform duration-500 group-hover:rotate-12`}>
                   <PlanIcon className={`w-6 h-6 ${plan.accent}`} />
                </div>

                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-10">
                   <span className="text-5xl font-black italic">₹{plan.price}</span>
                   <span className="text-[10px] font-black text-zinc-600 uppercase italic tracking-widest">/ ONE_TIME</span>
                </div>

                {/* Benefits List */}
                <div className="space-y-6 mb-12 flex-1">
                   {/* Meta stats */}
                   <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                         <Play className="w-3 h-3 text-white" />
                         <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">View Time</span>
                         <span className="text-[11px] font-bold italic">{plan.time}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                         <Download className="w-3 h-3 text-white" />
                         <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Downloads</span>
                         <span className="text-[11px] font-bold italic">{plan.downloads}</span>
                      </div>
                   </div>

                   <div className="space-y-3">
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-center gap-3 text-[11px] font-bold italic text-zinc-400 group-hover:text-zinc-200 transition-colors">
                           <Verified className="w-3.5 h-3.5 text-zinc-700" />
                           {f}
                        </div>
                      ))}
                   </div>
                </div>

                <Button
                  onClick={() => handleSubscription(plan)}
                  disabled={isCurrent || isLower || loading !== null}
                  className={`w-full h-16 rounded-3xl font-black text-[12px] uppercase tracking-[0.3em] transition-all duration-500 scale-95 hover:scale-100 ${
                    isCurrent
                      ? "bg-white text-black cursor-default shadow-xl" 
                      : isLower
                      ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                      : "bg-white text-black hover:bg-zinc-200 hover:text-black"
                  }`}
                >
                  {loading === plan.id ? "Processing..." : 
                   isCurrent ? "✓ Current Plan" : 
                   isLower ? "Included" :
                   "Upgrade Now"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Comparison Table (Footer) */}
        <div className="relative p-12 md:p-20 rounded-[4rem] bg-white/[0.01] border border-zinc-900 overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <h2 className="text-3xl font-black italic uppercase italic tracking-tighter mb-8 max-w-2xl mx-auto">
              Ready to Upgrade your Profile?
            </h2>
            <p className="text-zinc-600 font-bold italic text-sm mb-12 max-w-xl mx-auto">
              All memberships include high-speed routing and priority library sync. 
              Join a community of premium creators on YourTube.
            </p>
            <div className="flex flex-wrap justify-center gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
               <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest">Secure Payments</span>
               </div>
               <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest">Global CDN</span>
               </div>
               <div className="flex items-center gap-3">
                  <Verified className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest">Authentic Content</span>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
}
