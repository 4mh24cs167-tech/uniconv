"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Script from "next/script";

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (planId: string) => {
    setLoading(true);
    
    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://uniconv.onrender.com";
      const res = await fetch(`${apiUrl}/api/subscriptions/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          user_id: session.user.id
        })
      });
      
      if (!res.ok) {
        throw new Error("Failed to create order. Please check Razorpay configuration.");
      }
      
      const data = await res.json();
      
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "UniConv",
        description: `${planId.toUpperCase()} Plan Subscription`,
        order_id: data.order_id,
        handler: function (response: any) {
          alert(`Payment successful! Welcome to the ${planId} tier! Refreshing...`);
          router.push("/dashboard");
        },
        theme: {
          color: "#8b5cf6" // Purple-500
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-slate-50 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-xl text-slate-500">
            Choose the plan that best fits your document workflow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Free</h3>
              <p className="text-slate-500 mt-2">For occasional document tasks.</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-slate-900">$0</span>
              <span className="text-slate-500 font-medium">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {["350 MB Max File Size", "Unlimited Operations", "Standard Processing Speed", "Basic Tools"].map((feature, i) => (
                <li key={i} className="flex items-center text-slate-700">
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
              {["Batch Processing", "OCR Text Extraction", "Priority Processing"].map((feature, i) => (
                <li key={i} className="flex items-center text-slate-400">
                  <X className="w-5 h-5 text-slate-300 mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full py-6 text-lg font-bold" onClick={() => router.push("/login")}>
              Get Started for Free
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 flex flex-col relative overflow-hidden">
            <div className="mb-6 relative">
              <span className="absolute top-0 right-0 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Advanced
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Pro</h3>
              <p className="text-slate-500 mt-2">For power users and professionals.</p>
            </div>
            <div className="mb-8 relative">
              <span className="text-5xl font-extrabold text-slate-900">$4.99</span>
              <span className="text-slate-500 font-medium">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1 relative">
              {[
                "1 GB Max File Size", 
                "Unlimited Operations", 
                "Priority Processing Speed", 
                "Batch Processing (up to 50)",
                "Basic Tools"
              ].map((feature, i) => (
                <li key={i} className="flex items-center text-slate-700">
                  <Check className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
              {["OCR Text Extraction"].map((feature, i) => (
                <li key={i} className="flex items-center text-slate-400">
                  <X className="w-5 h-5 text-slate-300 mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button 
              variant="outline"
              className="w-full py-6 text-lg font-bold hover:bg-slate-50"
              onClick={() => handleUpgrade('pro')}
              disabled={loading}
            >
              {loading ? "Preparing Checkout..." : "Upgrade to Pro"}
            </Button>
          </div>

          {/* Premium Plan */}
          <div className="bg-slate-900 rounded-3xl shadow-2xl shadow-purple-900/20 p-8 border border-slate-800 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <div className="w-32 h-32 bg-purple-500 rounded-full blur-3xl" />
            </div>
            <div className="mb-6 relative">
              <span className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Most Popular
              </span>
              <h3 className="text-2xl font-bold text-white">Premium</h3>
              <p className="text-slate-400 mt-2">No limits, all features included.</p>
            </div>
            <div className="mb-8 relative">
              <span className="text-5xl font-extrabold text-white">$9.99</span>
              <span className="text-slate-400 font-medium">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1 relative">
              {[
                "Unlimited File Size", 
                "Unlimited Operations", 
                "Ultra-Fast Processing", 
                "Unlimited Batch Processing",
                "OCR Text Extraction",
                "All Advanced Tools"
              ].map((feature, i) => (
                <li key={i} className="flex items-center text-slate-300">
                  <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button 
              className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 border-0 shadow-lg shadow-purple-500/25 relative"
              onClick={() => handleUpgrade('premium')}
              disabled={loading}
            >
              {loading ? "Preparing Checkout..." : "Upgrade to Premium"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
