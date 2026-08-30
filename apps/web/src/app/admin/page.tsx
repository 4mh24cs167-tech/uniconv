"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Shield, Users, Database, ArrowLeft, Loader2, Search, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";

export default function AdminPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin-login");
        return;
      }
      
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@uniconv.com";
      if (session.user.email !== adminEmail) {
        router.push("/admin-login");
        return;
      }
      
      setAdminEmail(session.user.email || "");

      // Fetch users and their plans
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          plan:plans(name)
        `)
        .order("created_at", { ascending: false });

      if (data) {
        setUsers(data);
      }
      setLoading(false);
    };

    checkAdminAndFetch();
  }, [router, supabase]);

  const handleUpdatePlan = async (userId: string, newPlanName: string) => {
    try {
      // 1. Find the plan_id for the requested plan
      const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("id")
        .eq("name", newPlanName)
        .single();
        
      if (planError || !planData) {
        alert(`Error finding plan ${newPlanName}`);
        return;
      }
      
      // 2. Update the user
      const { error: updateError } = await supabase
        .from("users")
        .update({ plan_id: planData.id })
        .eq("id", userId);
        
      if (updateError) {
        alert("Failed to update user plan.");
        console.error(updateError);
        return;
      }

      // Send email notification
      const user = users.find(u => u.id === userId);
      if (user && user.email) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://uniconv.onrender.com";
        await fetch(`${apiUrl}/api/admin/notify-upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_email: user.email,
            plan_name: newPlanName
          })
        }).catch(err => console.error("Failed to notify user:", err));
      }
      
      alert(`User successfully upgraded to ${newPlanName}!`);
      
      // 3. Refresh the users list locally
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return { ...u, plan: { name: newPlanName } };
        }
        return u;
      }));
    } catch (e) {
      console.error(e);
      alert("An error occurred");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/")} className="text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Exit Admin
            </Button>
            <div className="h-6 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-500/20 text-red-500 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold tracking-tight">Admin Console</span>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-400">
            Logged in as <span className="text-white">{adminEmail}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Total Users</p>
                <h3 className="text-2xl font-bold text-slate-900">{users.length}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Premium Users</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {users.filter(u => u.plan?.name === 'Premium' || u.plan?.name === 'Pro').length}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800">User Management</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-sm text-slate-500 font-semibold">
                  <th className="p-4 pl-6">User</th>
                  <th className="p-4">Current Plan</th>
                  <th className="p-4">Storage Used</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="font-semibold text-slate-900">{user.name || "Anonymous User"}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <span className={clsx(
                          "px-2.5 py-1 rounded-full text-xs font-bold",
                          user.plan?.name === 'Premium' ? "bg-purple-100 text-purple-700" :
                          user.plan?.name === 'Pro' ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {user.plan?.name || "Free"}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {((user.storage_used_bytes || 0) / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleUpdatePlan(user.id, "Pro")}
                          className="text-slate-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-4 h-4 mr-2" /> Upgrade
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
