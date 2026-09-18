"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// --- Types ---
interface ToolUsage {
  tool: string;
  total_jobs: number;
  completed: number;
  failed: number;
  processing: number;
  queued: number;
  success_rate: number;
}

interface UserStats {
  total_users: number;
  new_users_7d: number;
  active_users: number;
}

interface DailyJob {
  date: string;
  total: number;
  completed: number;
  failed: number;
}

interface FailedJob {
  id: string;
  tool: string;
  error_message: string;
  user_id: string | null;
  created_at: string;
}

interface AnalyticsData {
  tool_usage: { total_jobs: number; tools: ToolUsage[] };
  daily_jobs: DailyJob[];
  failed_jobs: FailedJob[];
  recent_jobs: FailedJob[];
  user_stats: UserStats;
}

function StatCard({ title, value, sub, color }: { title: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ToolTable({ tools }: { tools: ToolUsage[] }) {
  if (tools.length === 0) {
    return <p className="text-slate-500 text-center py-8">No data yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-medium text-slate-600">Tool</th>
            <th className="text-center py-3 px-4 font-medium text-slate-600">Total</th>
            <th className="text-center py-3 px-4 font-medium text-green-600">Completed</th>
            <th className="text-center py-3 px-4 font-medium text-red-600">Failed</th>
            <th className="text-center py-3 px-4 font-medium text-slate-600">Processing</th>
            <th className="text-center py-3 px-4 font-medium text-slate-600">Success Rate</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.tool} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 px-4 font-medium text-slate-800">{tool.tool}</td>
              <td className="text-center py-3 px-4">{tool.total_jobs}</td>
              <td className="text-center py-3 px-4 text-green-600">{tool.completed}</td>
              <td className="text-center py-3 px-4 text-red-600">{tool.failed}</td>
              <td className="text-center py-3 px-4">{tool.processing}</td>
              <td className="text-center py-3 px-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tool.success_rate >= 80 ? "bg-green-100 text-green-700" : tool.success_rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {tool.success_rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyChart({ data }: { data: DailyJob[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((day) => (
        <div key={day.date} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-24 shrink-0">
            {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
            {/* Completed bar */}
            <div
              className="absolute top-0 left-0 h-full bg-green-500 opacity-70"
              style={{ width: `${(day.completed / maxVal) * 100}%` }}
            />
            {/* Failed bar on top */}
            <div
              className="absolute top-0 h-full bg-red-500 opacity-70"
              style={{ width: `${(day.failed / maxVal) * 100}%`, left: `${(day.completed / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-600 w-16 text-right font-medium">{day.total} jobs</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const router = useRouter();

  // Check admin status
  useEffect(() => {
    const token = localStorage.getItem("uniconv_access_token");
    if (!token) { router.push("/login"); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) { router.push("/login"); return null; }
        return r.json();
      })
      .then((user) => {
        if (!user) return;
        // Check admin via analytics endpoint (403 if not admin)
        return fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => {
          if (r.ok) {
            setIsAdmin(true);
            return r.json();
          } else if (r.status === 403) {
            router.push("/dashboard");
          } else {
            router.push("/login");
          }
          return null;
        });
      })
      .then((analytics) => {
        if (analytics) setData(analytics);
        setLoading(false);
        setCheckingAdmin(false);
      })
      .catch(() => { router.push("/login"); setCheckingAdmin(false); });
  }, [router]);

  if (checkingAdmin || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin || !data) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-bold text-slate-800">Admin Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">Admin</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* User Stats */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Users</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Users" value={data.user_stats.total_users} color="text-blue-600" />
            <StatCard title="New Users (7d)" value={data.user_stats.new_users_7d} color="text-green-600" />
            <StatCard title="Active Users" value={data.user_stats.active_users} color="text-purple-600" />
          </div>
        </section>

        {/* Overview Stats */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Jobs" value={data.tool_usage.total_jobs} sub="All time" color="text-slate-800" />
            <StatCard title="Completed" value={data.tool_usage.tools.reduce((s, t) => s + t.completed, 0)} color="text-green-600" />
            <StatCard title="Failed" value={data.tool_usage.tools.reduce((s, t) => s + t.failed, 0)} color="text-red-600" />
          </div>
        </section>

        {/* Daily Activity Chart */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Daily Activity (Last 7 Days)</h2>
          <DailyChart data={data.daily_jobs} />
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-slate-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-slate-600">Failed</span>
            </div>
          </div>
        </section>

        {/* Tool Usage Table */}
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Tool Usage Breakdown</h2>
          </div>
          <ToolTable tools={data.tool_usage.tools} />
        </section>

        {/* Failed Jobs */}
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Recent Failed Jobs</h2>
            <p className="text-sm text-slate-500 mt-1">Jobs that encountered errors — click to investigate</p>
          </div>
          {data.failed_jobs.length === 0 ? (
            <p className="text-green-600 text-center py-8">No failed jobs — everything working!</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.failed_jobs.slice(0, 20).map((job) => (
                <div key={job.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{job.tool}</span>
                        <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">FAILED</span>
                      </div>
                      <p className="text-sm text-red-600 mt-1 font-mono bg-red-50 p-2 rounded">
                        {job.error_message || "Unknown error"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        User: {job.user_id ? job.user_id.slice(0, 8) : "anonymous"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
