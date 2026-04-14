import { useUser } from "@/lib/AuthContext";
import { startRazorpayPayment } from "@/lib/payment";
import React from "react";

const plans = [
  { key: "BRONZE", price: 10, watch: "7 minutes" },
  { key: "SILVER", price: 50, watch: "10 minutes" },
  { key: "GOLD", price: 100, watch: "Unlimited" },
];

const PlansPage = () => {
  const { user, login } = useUser();

  const upgradePlan = async (plan: string) => {
    if (!user) {
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
    <main className="flex-1 p-4">
      <h1 className="text-2xl font-semibold">Upgrade Plan</h1>
      <p className="text-sm text-gray-600 mb-4">Free plan watch limit: 5 minutes.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.key} className="rounded-xl border p-4">
            <h2 className="font-semibold text-lg">{plan.key}</h2>
            <p className="text-sm text-gray-500">INR {plan.price}</p>
            <p className="text-sm mt-2">Watch limit: {plan.watch}</p>
            <button
              className="mt-4 bg-black text-white px-3 py-2 rounded"
              onClick={() => upgradePlan(plan.key)}
            >
              Choose {plan.key}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
};

export default PlansPage;
