"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Check, Crown, Zap, Shield, Star } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

const PLANS = [
  {
    name: "Free",
    price: 0,
    time: "5 Min",
    downloads: "1/Day",
    features: ["Standard Quality", "Ads Supported"],
    icon: Star,
    color: "bg-gray-100",
  },
  {
    name: "Bronze",
    price: 10,
    time: "7 Min",
    downloads: "Unlimited",
    features: ["No Ads", "Basic Support"],
    icon: Zap,
    color: "bg-orange-50",
  },
  {
    name: "Silver",
    price: 50,
    time: "10 Min",
    downloads: "Unlimited",
    features: ["No Ads", "Priority Support", "HD Content"],
    icon: Shield,
    color: "bg-blue-50",
  },
  {
    name: "Gold",
    price: 100,
    time: "Unlimited",
    downloads: "Unlimited",
    features: ["4K Quality", "Vip Support", "Exclusive Content"],
    icon: Crown,
    color: "bg-yellow-50",
  },
];

const PremiumModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, login } = useUser();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-premium-modal", handleOpen);
    return () => window.removeEventListener("open-premium-modal", handleOpen);
  }, []);

  const handleSubscription = async (plan: any) => {
    if (!user) return alert("Please sign in first");
    if (plan.price === 0) return setIsOpen(false);

    setLoading(true);
    try {
      const { data: order } = await axiosInstance.post("/payment/create-order", {
        amount: plan.price,
        plan: plan.name,
        userId: user._id,
      });

      if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        throw new Error("Payment key missing. Configure NEXT_PUBLIC_RAZORPAY_KEY_ID.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "youtube2.0 Premium",
        description: `${plan.name} Plan Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await axiosInstance.post("/payment/verify-payment", {
              ...response,
              userId: user._id,
              plan: plan.name,
              amount: plan.price
            });
            
            if (verifyRes.data.plan) {
              alert(`Success! You are now a ${plan.name} member.`);
              login({ ...user, plan: plan.name });
              setIsOpen(false);
            }
          } catch (err) {
            console.error(err);
            alert("Payment failed.");
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: /8838733794$/.test(String(user.mobile || "").replace(/\s+/g, ""))
            ? ""
            : String(user.mobile || "").replace(/\s+/g, ""),
        },
        theme: {
          color: "#dc2626",
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-white border-none shadow-2xl rounded-3xl">
        <div className="bg-gradient-to-br from-gray-900 via-red-900 to-black p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/20 blur-3xl rounded-full -mr-32 -mt-32" />
          <div className="relative z-10">
            <DialogTitle className="text-4xl font-black flex items-center gap-3 tracking-tight">
              <Crown className="w-10 h-10 text-yellow-500 fill-yellow-500 animate-pulse" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription className="text-gray-300 mt-3 text-lg max-w-lg leading-relaxed">
              Unlock the full potential of YouTube 2.0 with professional features, 
              unlimited watch time, and record-breaking downloads.
            </DialogDescription>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8 bg-gray-50/50">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`group flex flex-col p-6 rounded-[2.5rem] border-2 transition-all duration-300 bg-white ${
                user?.plan === plan.name 
                  ? "border-red-500 shadow-xl shadow-red-100 scale-105" 
                  : "border-transparent hover:border-red-200 hover:shadow-2xl hover:-translate-y-1"
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
                plan.name === 'Gold' ? 'bg-yellow-100 text-yellow-600' :
                plan.name === 'Silver' ? 'bg-blue-100 text-blue-600' :
                plan.name === 'Bronze' ? 'bg-orange-100 text-orange-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                <plan.icon className="w-6 h-6" />
              </div>

              <h3 className="font-bold text-xl text-gray-900">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1 mb-6">
                <span className="text-3xl font-black text-gray-900">₹{plan.price}</span>
                <span className="text-sm font-medium text-gray-400">/one-time</span>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daily Watch</span>
                  <span className="text-sm font-black text-red-600">{plan.time}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Downloads</span>
                  <span className="text-sm font-black text-blue-600">{plan.downloads}</span>
                </div>
                
                <div className="pt-2 space-y-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm text-gray-600 font-medium">
                      <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className={`mt-auto w-full py-6 rounded-2xl font-bold text-lg transition-all ${
                  user?.plan === plan.name
                    ? "bg-gray-100 text-gray-400 cursor-default"
                    : "bg-red-600 text-white shadow-lg shadow-red-200 hover:bg-black hover:shadow-none active:scale-95"
                }`}
                disabled={loading || user?.plan === plan.name}
                onClick={() => handleSubscription(plan)}
              >
                {user?.plan === plan.name ? "Current" : plan.price === 0 ? "Default" : "Go Premium"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumModal;
