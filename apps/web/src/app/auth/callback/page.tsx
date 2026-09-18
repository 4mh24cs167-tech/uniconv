"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function AuthCallbackContent() {
  const [status, setStatus] = useState("Completing sign-in...");
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken) {
          localStorage.setItem("uniconv_access_token", accessToken);
          if (refreshToken) {
            localStorage.setItem("uniconv_refresh_token", refreshToken);
          }

          // Verify user
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
          const res = await fetch(`${apiUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (res.ok) {
            setStatus("Welcome! Redirecting...");
            setTimeout(() => router.push("/dashboard"), 1000);
          } else {
            setStatus("Authentication failed. Redirecting to login...");
            setTimeout(() => router.push("/login"), 2000);
          }
        } else {
          setStatus("No access token received. Redirecting to login...");
          setTimeout(() => router.push("/login"), 2000);
        }
      } catch {
        setStatus("Something went wrong. Redirecting to login...");
        setTimeout(() => router.push("/login"), 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
