import { useUser } from "@/lib/AuthContext";
import { startRazorpayPayment } from "@/lib/payment";
import React from "react";

const PremiumDownloadPage = () => {
  const { user, login } = useUser();

  const handleUpgrade = async () => {
    if (!user) {
      window.alert("Please sign in first");
      return;
    }
    await startRazorpayPayment({
      user,
      plan: "FREE",
      purpose: "premium_download",
      onSuccess: (updatedUser) => login(updatedUser),
    });
  };

  return (
    <main className="flex-1 p-4">
      <h1 className="text-2xl font-semibold">Premium Download</h1>
      <p className="mt-2 text-gray-600">
        Free plan allows only one download per day. Upgrade to unlock unlimited downloads.
      </p>
      <button
        className="mt-6 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleUpgrade}
      >
        Upgrade with Razorpay (Test)
      </button>
    </main>
  );
};

export default PremiumDownloadPage;
