"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "4mh24cs167@gmail.com";
      if (data.user?.email === adminEmail) {
        router.push("/admin");
      } else {
        setError("Unauthorized. This portal is for administrators only.");
        await supabase.auth.signOut();
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl shadow-purple-900/20 w-full max-w-md border border-slate-800 relative">
        <Button variant="ghost" className="absolute top-4 left-4 text-slate-400 hover:text-white" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex flex-col items-center justify-center mb-8 mt-6">
          <div className="p-4 bg-purple-500/10 text-purple-500 rounded-2xl mb-4 border border-purple-500/20">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Admin Portal Access
          </h2>
          <p className="text-slate-400 text-sm mt-2">Secure restricted area</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Admin Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="4mh24cs167@gmail.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 border-0 mt-4 text-white"
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Login to Admin Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
