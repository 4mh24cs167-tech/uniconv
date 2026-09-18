"""
analytics_service.py — Admin analytics queries for UniConv.
"""
from datetime import datetime, timedelta, timezone
from collections import Counter
from supabase import create_client, Client
import os

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_KEY", "")
)

def get_tool_usage_stats() -> dict:
    """Get how many times each tool has been used, broken down by status."""
    result = supabase.table("processing_jobs") \
        .select("tool, status, user_id") \
        .execute()

    jobs = result.data or []
    total = len(jobs)

    # Count by tool
    tool_counts = Counter(j["tool"] for j in jobs)
    tool_status = {}
    for j in jobs:
        tool = j["tool"]
        status = j["status"]
        if tool not in tool_status:
            tool_status[tool] = Counter()
        tool_status[tool][status] += 1

    # Format
    tools = []
    for tool_name, count in tool_counts.most_common():
        status_breakdown = dict(tool_status.get(tool_name, {}))
        tools.append({
            "tool": tool_name,
            "total_jobs": count,
            "completed": status_breakdown.get("COMPLETED", 0),
            "failed": status_breakdown.get("FAILED", 0),
            "processing": status_breakdown.get("PROCESSING", 0),
            "queued": status_breakdown.get("QUEUED", 0),
            "success_rate": round((status_breakdown.get("COMPLETED", 0) / count * 100), 1) if count > 0 else 0,
        })

    return {
        "total_jobs": total,
        "tools": tools,
    }


def get_jobs_last_7_days() -> list[dict]:
    """Get daily job counts for the last 7 days."""
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = supabase.table("processing_jobs") \
        .select("tool, status, created_at") \
        .gte("created_at", seven_days_ago) \
        .execute()

    jobs = result.data or []

    # Group by date
    daily = {}
    for j in jobs:
        date = j["created_at"][:10]  # YYYY-MM-DD
        if date not in daily:
            daily[date] = {"total": 0, "completed": 0, "failed": 0}
        daily[date]["total"] += 1
        if j["status"] == "COMPLETED":
            daily[date]["completed"] += 1
        elif j["status"] == "FAILED":
            daily[date]["failed"] += 1

    # Fill in missing dates
    dates = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        dates.append(d)

    return [{"date": d, **daily.get(d, {"total": 0, "completed": 0, "failed": 0})} for d in dates]


def get_failed_jobs(limit: int = 50) -> list[dict]:
    """Get recent failed jobs with error messages."""
    result = supabase.table("processing_jobs") \
        .select("id, tool, error_message, user_id, created_at, status") \
        .eq("status", "FAILED") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    return result.data or []


def get_recent_jobs(limit: int = 50) -> list[dict]:
    """Get most recent jobs."""
    result = supabase.table("processing_jobs") \
        .select("id, tool, status, progress, error_message, user_id, created_at") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    return result.data or []


def get_user_stats() -> dict:
    """Get user registration stats."""
    # Total users
    users_result = supabase.table("users").select("id", count="exact").execute()
    total_users = users_result.count or 0

    # Users registered in last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_users = supabase.table("users") \
        .select("id", count="exact") \
        .gte("created_at", seven_days_ago) \
        .execute()
    new_users_7d = recent_users.count or 0

    # Active users (users with at least one job)
    active_result = supabase.table("processing_jobs") \
        .select("user_id") \
        .not_.is_("user_id", None) \
        .execute()
    active_user_ids = set(j["user_id"] for j in (active_result.data or []) if j.get("user_id"))
    active_users = len(active_user_ids)

    return {
        "total_users": total_users,
        "new_users_7d": new_users_7d,
        "active_users": active_users,
    }


def get_all_analytics() -> dict:
    """Get all analytics data for admin dashboard."""
    return {
        "tool_usage": get_tool_usage_stats(),
        "daily_jobs": get_jobs_last_7_days(),
        "failed_jobs": get_failed_jobs(),
        "recent_jobs": get_recent_jobs(),
        "user_stats": get_user_stats(),
    }
