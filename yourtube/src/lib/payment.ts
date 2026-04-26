import axiosInstance from "@/lib/axiosinstance";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export const startRazorpayPayment = async ({
  user,
  plan,
  purpose,
  onSuccess,
}: {
  user: any;
  plan: string;
  purpose: "plan" | "premium_download";
  onSuccess: (updatedUser: any) => void;
}) => {
  const ready = await loadRazorpayScript();
  if (!ready) {
    window.alert("Razorpay SDK failed to load");
    return;
  }

  const orderRes = await axiosInstance.post("/payment/create-order", {
    userId: user._id,
    plan,
    purpose,
  });

  const { order, key } = orderRes.data;
  const rawContact = typeof user.mobile === "string" ? user.mobile.replace(/\s+/g, "") : "";
  const safeContact = /8838733794$/.test(rawContact) ? "" : rawContact;

  const options = {
    key,
    amount: order.amount,
    currency: order.currency,
    name: "youtube2.0",
    description: purpose === "plan" ? `Plan upgrade to ${plan}` : "Premium download",
    order_id: order.id,
    handler: async (response: any) => {
      const verifyRes = await axiosInstance.post("/payment/verify", {
        userId: user._id,
        plan,
        purpose,
        ...response,
      });
      onSuccess(verifyRes.data.user);
      window.alert("Payment successful");
    },
    prefill: {
      name: user.name,
      email: user.email,
      contact: safeContact,
    },
    theme: {
      color: "#2563eb",
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
};
