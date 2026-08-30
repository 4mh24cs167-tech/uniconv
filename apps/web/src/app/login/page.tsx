"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/'); // Or dashboard
      }
    };
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          router.push('/dashboard');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100 relative">
        <Button variant="ghost" className="absolute top-4 left-4 text-slate-500" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center justify-center mb-8 mt-6 gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <FileText className="w-8 h-8" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-slate-800">
            uniconv
          </span>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-slate-900 mb-6">
          Welcome back
        </h2>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#e5322d',
                  brandAccent: '#d42d28',
                }
              }
            },
            className: {
              button: 'w-full px-4 py-3 rounded-lg font-semibold',
              input: 'w-full px-4 py-3 rounded-lg border border-slate-300',
              label: 'text-sm font-medium text-slate-700',
            }
          }}
          providers={['google']}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
        />
      </div>
    </div>
  );
}
