"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { FileText, Download, Clock, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const fetchJobsAndPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch user's plan
      const { data: userData } = await supabase
        .from("users")
        .select("plan")
        .eq("id", session.user.id)
        .single();
        
      if (userData?.plan) {
        setPlan(userData.plan);
      }

      // Fetch jobs with their result file data
      const { data, error } = await supabase
        .from("processing_jobs")
        .select(`
          *,
          result_file:files!processing_jobs_result_file_id_fkey(*)
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setJobs(data);
      }
      setLoading(false);
    };

    fetchJobsAndPlan();
  }, [router, supabase]);

  const handleDownload = async (file: any) => {
    if (!file?.storage_key) return;
    const { data } = supabase.storage.from("results").getPublicUrl(file.storage_key);
    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  const handleDelete = async (jobId: string, resultFileId: string | null) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    
    // Optimistic UI update
    setJobs(jobs.filter(j => j.id !== jobId));
    
    // Delete the job from DB
    await supabase.from("processing_jobs").delete().eq("id", jobId);
    
    // Optionally delete the result file if it exists (cascade or manual)
    if (resultFileId) {
       await supabase.from("files").delete().eq("id", resultFileId);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push("/")} className="mb-4 -ml-4 text-slate-500">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tools
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 mt-2">Manage your recent conversions and files.</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              <span className={clsx(
                "text-xl font-bold uppercase",
                plan === "premium" ? "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600" :
                plan === "pro" ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600" :
                "text-slate-900"
              )}>
                {plan} Tier
              </span>
              <Button onClick={() => router.push("/admin")} variant="ghost" size="sm" className="ml-2 text-slate-500 hover:text-slate-800">
                Admin
              </Button>
              {plan === "free" && (
                <Button onClick={() => router.push("/pricing")} variant="outline" size="sm" className="ml-2 text-purple-600 border-purple-200 hover:bg-purple-50">
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Recent Conversions</h2>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No conversions yet</p>
              <p className="text-sm">Head over to the tools page to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <div key={job.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      job.status === "COMPLETED" ? "bg-green-100 text-green-600" :
                      job.status === "FAILED" ? "bg-red-100 text-red-600" :
                      "bg-blue-100 text-blue-600"
                    )}>
                      {job.status === "COMPLETED" && <CheckCircle2 className="w-6 h-6" />}
                      {job.status === "FAILED" && <XCircle className="w-6 h-6" />}
                      {(job.status === "QUEUED" || job.status === "PROCESSING") && <Loader2 className="w-6 h-6 animate-spin" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{job.tool.replace(/_/g, " ")}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className={clsx(
                          job.status === "COMPLETED" ? "text-green-600 font-medium" :
                          job.status === "FAILED" ? "text-red-600 font-medium" :
                          "text-blue-600 font-medium"
                        )}>
                          {job.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {job.status === "COMPLETED" && job.result_file && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleDownload(job.result_file)}
                        className="font-semibold"
                      >
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    )}
                    {job.status === "FAILED" && (
                      <div className="text-sm text-red-500 max-w-xs truncate mr-4" title={job.error_message}>
                        {job.error_message}
                      </div>
                    )}
                    <button 
                      onClick={() => handleDelete(job.id, job.result_file?.id || null)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete Record"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
