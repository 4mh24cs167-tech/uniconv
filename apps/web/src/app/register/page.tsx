"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Auth Context ---
interface User {
  id: string;
  email: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || "";

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("uniconv_access_token");
      if (!token) { setLoading(false); return; }

      const res = await fetch(`${getApiUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem("uniconv_access_token");
        localStorage.removeItem("uniconv_refresh_token");
      }
    } catch {
      localStorage.removeItem("uniconv_access_token");
      localStorage.removeItem("uniconv_refresh_token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${getApiUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.msg || "Login failed");

    localStorage.setItem("uniconv_access_token", data.session.access_token);
    localStorage.setItem("uniconv_refresh_token", data.session.refresh_token);
    setUser(data.user);
  };

  const logout = async () => {
    localStorage.removeItem("uniconv_access_token");
    localStorage.removeItem("uniconv_refresh_token");
    setUser(null);
    router.push("/");
  };

  useEffect(() => { checkAuth(); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Register Page ---
type Step = "email" | "otp" | "success";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.msg || "Failed to send OTP");
      setStep("otp");
      setCountdown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.msg || "Verification failed");

      // Save tokens
      localStorage.setItem("uniconv_access_token", data.session.access_token);
      localStorage.setItem("uniconv_refresh_token", data.session.refresh_token);
      setStep("success");

      // Redirect to dashboard after 2 seconds
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.msg || "Failed to resend");
      setCountdown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100 relative">
        <Link href="/" className="absolute top-4 left-4 text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </Link>

        <div className="flex items-center justify-center mb-8 mt-6 gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-slate-800">UniConv</span>
        </div>

        {/* Step 1: Email & Password */}
        {step === "email" && (
          <>
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Create account</h2>
            <p className="text-center text-slate-500 text-sm mb-6">Enter your details to get started</p>
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  minLength={6}
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Continue with Email"}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account? <Link href="/login" className="text-red-600 hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}

        {/* Step 2: OTP Verification */}
        {step === "otp" && (
          <>
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Verify your email</h2>
            <p className="text-center text-slate-500 text-sm mb-6">
              We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>
            </p>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-center text-2xl tracking-widest"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || countdown > 0}
                className="w-full text-slate-500 hover:text-slate-700 text-sm py-2 disabled:opacity-50"
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-4">
              Wrong email? <button onClick={() => setStep("email")} className="text-red-600 hover:underline">Change</button>
            </p>
          </>
        )}

        {/* Step 3: Success */}
        {step === "success" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Account created!</h2>
            <p className="text-slate-500">Redirecting to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
