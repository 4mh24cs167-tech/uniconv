import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Private service role client - never exposed to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  // Verify against unexposed server environment secret
  if (error || !user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden: Admin required" }, { status: 403 });
  }
  
  try {
    const { targetUserId, newPlanName } = await req.json();
    
    if (!targetUserId || !newPlanName) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const { data: plan } = await supabaseAdmin.from("plans").select("id").eq("name", newPlanName).single();
    if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    
    const { error: updateError } = await supabaseAdmin.from("users").update({ plan_id: plan.id }).eq("id", targetUserId);
    
    if (updateError) {
        throw updateError;
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
