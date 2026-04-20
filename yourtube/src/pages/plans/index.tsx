import { useUser } from "@/lib/AuthContext";
import { startRazorpayPayment } from "@/lib/payment";
import React from "react";
import { CheckCircle2, Crown, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    key: "BRONZE",
    price: 10,
    watch: "7 minutes",
    description: "Perfect for quick sessions",
    color: "from-orange-700/20 to-orange-500/10",
    border: "border-orange-500/20",
    btn: "bg-orange-600 hover:bg-orange-700",
    features: ["7min Watch limit", "Standard Quality", "Community Support"],
    icon: <Zap className="w-8 h-8 text-orange-500" />,
  },
  {
    key: "SILVER",
    price: 50,
    watch: "10 minutes",
    description: "Most popular for enthusiasts",
    color: "from-cyan-700/20 to-blue-500/10",
    border: "border-cyan-500/30",
    btn: "bg-cyan-600 hover:bg-cyan-700",
    features: ["10min Watch limit", "HD Quality", "Priority Support", "No Ads"],
    icon: <Sparkles className="w-8 h-8 text-cyan-400" />,
    popular: true,
  },
  {
    key: "GOLD",
    price: 100,
    watch: "Unlimited",
    description: "The ultimate YouTube experience",
    color: "from-amber-700/30 to-yellow-500/10",
    border: "border-amber-500/50",
    btn: "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700",
    features: ["Unlimited Watching", "4K Ultra HD", "Dedicated Support", "Offline Downloads", "Exclusive Badges"],
    icon: <Crown className="w-10 h-10 text-amber-400" />,
  },
];

const PlansPage = () => {
  const { user, login } = useUser();

  // Derive current limit label dynamically from user profile
  const currentPlan = user?.plan || "FREE";
  const rawMinutes = user?.watchLimitMinutes;
  const limitLabel =
    rawMinutes === null || rawMinutes === undefined
      ? currentPlan === "GOLD"
        ? "Unlimited"
        : "5 minutes"
      : `${rawMinutes} minutes`;
  const planLabel = currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase();

  const upgradePlan = async (plan: string) => {
    if (!user) {
      // toast.error is handled in AuthContext but we check here too
      window.alert("Please sign in first");
      return;
    }
    await startRazorpayPayment({
      user,
      plan,
      purpose: "plan",
      onSuccess: (updatedUser) => login(updatedUser),
    });
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 selection:bg-amber-500/30">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest animate-pulse">
            <Sparkles className="w-3 h-3" />
            Premium Access
          </div>
          <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
            Elevate Your Viewing
          </h1>
          <p className="text-gray-400 text-lg">
            Choose the plan that fits your lifestyle. Your current limit:
            <span className="text-white font-bold ml-1">{limitLabel} ({planLabel})</span>
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid lg:grid-cols-3 gap-8 items-stretch pt-8">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                "relative group flex flex-col rounded-3xl border p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] bg-gradient-to-b",
                plan.color,
                plan.border,
                plan.popular && "lg:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.1)] border-cyan-500/50"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full text-xs font-black uppercase tracking-tighter shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{plan.key}</h2>
                  <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-500">
                  {plan.icon}
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-gray-400">INR</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={cn(
                  "w-full py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg",
                  plan.btn,
                  user?.plan === plan.key && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => upgradePlan(plan.key)}
                disabled={user?.plan === plan.key}
              >
                {user?.plan === plan.key ? "Current Plan" : `Get ${plan.key}`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 pt-12 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Secure payment via Razorpay
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Cancel anytime
          </div>
        </div>
      </div>
    </main>
  );
};

export default PlansPage;
