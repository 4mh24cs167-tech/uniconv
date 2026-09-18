import os
import asyncio
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request, Header, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Document Productivity API")

# Parse allowed origins from environment variable (comma-separated)
frontend_urls = os.getenv("FRONTEND_URL", "https://uniconv.vercel.app,https://uniconv-psi.vercel.app,http://localhost:3000")
allowed_origins = [u.strip().rstrip("/") for u in frontend_urls.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

url: str = os.getenv("SUPABASE_URL", "")
service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
anon_key: str = os.getenv("SUPABASE_KEY", "")
key: str = service_key or anon_key

supabase: Client = create_client(url, key) if url and key else None

# --- APScheduler Setup for Cleanup ---
from apscheduler.schedulers.background import BackgroundScheduler

def cleanup_old_files():
    try:
        if not supabase:
            return
        print("Running scheduled cleanup job for old files...")
        threshold_date = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        old_files = supabase.table("files").select("id, storage_key").lt("created_at", threshold_date).execute()
        if old_files.data:
            print(f"Found {len(old_files.data)} old files to delete.")
            for file in old_files.data:
                key_val = file.get("storage_key")
                if key_val:
                    try:
                        supabase.storage.from_("uploads").remove([key_val])
                        supabase.storage.from_("results").remove([key_val])
                    except Exception as e:
                        print(f"Failed to delete storage key {key_val}: {e}")
            file_ids = [f["id"] for f in old_files.data]
            supabase.table("files").delete().in_("id", file_ids).execute()
        print("Cleanup job finished.")
    except Exception as e:
        print(f"Error during cleanup job: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_files, 'interval', hours=12)
scheduler.start()

# Pre-download rembg model in background so first user doesn't wait
import threading

def _warm_up_rembg():
    try:
        import time
        # Wait a bit for the server to fully start
        time.sleep(5)
        from rembg.session_factory import new_session
        new_session('u2net')
        print("rembg u2net model pre-downloaded successfully")
    except Exception as e:
        print(f"rembg warm-up failed (will retry on first use): {e}")

threading.Thread(target=_warm_up_rembg, daemon=True).start()
# -----------------------------------

@app.get("/")
def read_root():
    return {"message": "Document Productivity API is running"}

# --- Razorpay Setup ---
import razorpay

RZP_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RZP_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RZP_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

razorpay_client = razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET)) if RZP_KEY_ID and RZP_KEY_SECRET else None

class RazorpayOrderRequest(BaseModel):
    plan_id: str
    user_id: str

@app.post("/api/subscriptions/create-order")
async def create_razorpay_order(req: RazorpayOrderRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured on server")
    plan_prices = {
        "pro": 499,
        "premium": 999
    }
    amount = plan_prices.get(req.plan_id.lower())
    if not amount:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    try:
        order_data = {
            "amount": amount,
            "currency": "USD",
            "receipt": f"receipt_{req.user_id}_{req.plan_id}",
            "notes": {
                "user_id": req.user_id,
                "plan_id": req.plan_id
            }
        }
        order = razorpay_client.order.create(data=order_data)
        return {
            "status": "success",
            "order_id": order["id"],
            "amount": amount,
            "currency": "USD",
            "key_id": RZP_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/subscriptions/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(None)):
    if not razorpay_client or not RZP_WEBHOOK_SECRET:
        return {"status": "ignored", "reason": "Razorpay not configured"}
    body = await request.body()
    try:
        razorpay_client.utility.verify_webhook_signature(
            body.decode("utf-8"),
            x_razorpay_signature,
            RZP_WEBHOOK_SECRET
        )
        payload = await request.json()
        event = payload.get("event")
        if event == "payment.captured" or event == "order.paid":
            payment_entity = payload["payload"].get("payment", {}).get("entity", {})
            notes = payment_entity.get("notes", {})
            user_id = notes.get("user_id")
            plan_name = notes.get("plan_id")
            if user_id and plan_name:
                plan_res = supabase.table("plans").select("id").eq("name", plan_name.capitalize()).execute()
                if plan_res.data:
                    plan_id = plan_res.data[0]["id"]
                    supabase.table("users").update({
                        "plan_id": plan_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", user_id).execute()
                    print(f"Automatically upgraded user {user_id} to {plan_name} via Webhook!")
        return {"status": "success"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Auth ---
security = HTTPBearer(auto_error=False)

async def get_current_user_optional(creds: Optional[HTTPAuthorizationCredentials] = Security(security)):
    if not creds or not supabase:
        return None
    try:
        res = supabase.auth.get_user(creds.credentials)
        if res and res.user:
            return {"id": res.user.id, "email": res.user.email}
    except Exception:
        pass
    return None

# --- Custom Email Auth (OTP via Brevo) ---
from src.services.auth_service import (
    signup_with_email, verify_otp, resend_otp, login_with_email
)
from pydantic import BaseModel

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResendOtpRequest(BaseModel):
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/signup")
def auth_signup(req: SignupRequest):
    """Step 1: Send OTP to email for verification."""
    try:
        result = signup_with_email(req.email, req.password, req.name)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/verify-otp")
def auth_verify_otp(req: VerifyOtpRequest):
    """Step 2: Verify OTP and create account."""
    try:
        result = verify_otp(req.email, req.otp)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/resend-otp")
def auth_resend_otp(req: ResendOtpRequest):
    """Resend OTP to email."""
    try:
        result = resend_otp(req.email)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    """Login with email and password."""
    try:
        result = login_with_email(req.email, req.password)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me")
def auth_me(current_user: Optional[dict] = Depends(get_current_user_optional)):
    """Get current user info."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"status": "success", "user": current_user}

@app.post("/api/auth/logout")
def auth_logout():
    """Logout (client-side clears tokens)."""
    return {"status": "success", "message": "Logged out"}

# --- Admin Analytics ---
from src.services.analytics_service import get_all_analytics, get_tool_usage_stats, get_failed_jobs

async def get_admin_user(current_user: Optional[dict] = Depends(get_current_user_optional)):
    """Verify the user is an admin."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_res = supabase.table("users").select("is_admin").eq("id", current_user["id"]).single().execute()
    user_data = user_res.data or {}
    if not user_data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@app.get("/api/admin/analytics")
def admin_analytics(admin: Optional[dict] = Depends(get_admin_user)):
    """Get all analytics data for admin dashboard."""
    try:
        data = get_all_analytics()
        return {"status": "success", **data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/tools")
def admin_tools(admin: Optional[dict] = Depends(get_admin_user)):
    """Get tool usage statistics."""
    try:
        data = get_tool_usage_stats()
        return {"status": "success", **data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/failed-jobs")
def admin_failed_jobs(admin: Optional[dict] = Depends(get_admin_user)):
    """Get failed jobs with error details."""
    try:
        jobs = get_failed_jobs()
        return {"status": "success", "jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Job Processing ---
class JobRequest(BaseModel):
    tool: str
    target_format: Optional[str] = None
    target_size_mb: Optional[float] = None
    input_file_ids: Optional[list[str]] = None
    configuration: Optional[dict] = None

@app.post("/api/jobs")
async def create_job(
    request: JobRequest,
    file_id: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    file_size = 0
    if file_id:
        file_res = supabase.table("files").select("size_bytes").eq("id", file_id).execute()
        if not file_res.data:
            raise HTTPException(status_code=404, detail="File not found")
        file_size = file_res.data[0]["size_bytes"]

    max_file_size = 350 * 1024 * 1024
    user_id = current_user.get("id") if current_user else None
    if user_id:
        user_res = supabase.table("users").select("plan_id").eq("id", user_id).execute()
        if user_res.data:
            user_data = user_res.data[0]
            if user_data.get("plan_id"):
                plan_res = supabase.table("plans").select("max_file_size_bytes").eq("id", user_data["plan_id"]).execute()
                if plan_res.data:
                    plan = plan_res.data[0]
                    if plan["max_file_size_bytes"] > 0:
                        max_file_size = plan["max_file_size_bytes"]
                    else:
                        max_file_size = float('inf')

    if file_size > max_file_size:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size for your tier. ({max_file_size / (1024*1024)}MB)")

    input_ids = request.input_file_ids if request.input_file_ids else ([file_id] if file_id else [])

    base_config = {
        "target_format": request.target_format,
        "target_size_mb": request.target_size_mb
    }
    if request.configuration:
        base_config.update(request.configuration)

    job_data = {
        "tool": request.tool,
        "input_file_ids": input_ids,
        "configuration": base_config,
        "status": "QUEUED",
        "user_id": user_id
    }

    try:
        response = supabase.table("processing_jobs").insert(job_data).execute()
        job = response.data[0]
        background_tasks.add_task(process_document_job, job["id"])
        return {"job_id": job["id"], "status": "QUEUED"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def process_document_job(job_id: str):
    try:
        import re
        import shutil
        import mimetypes
        import zipfile
        from src.services.pdf_service import PDFService

        print(f"Starting processing for job {job_id}")

        try:
            supabase.table("processing_jobs").update({"status": "PROCESSING", "progress": 10}).eq("id", job_id).execute()
        except Exception:
            supabase.table("processing_jobs").update({"status": "PROCESSING"}).eq("id", job_id).execute()

        job_res = supabase.table("processing_jobs").select("*").eq("id", job_id).single().execute()
        job = job_res.data
        input_ids = job.get("input_file_ids") or []
        tool = job["tool"]

        # Text-based tools (TTS, QR) don't require file uploads
        text_based_tools = {"Text to Speech", "QR Code Generator"}
        if not input_ids and tool not in text_based_tools:
            raise Exception("No input files provided for processing")

        with tempfile.TemporaryDirectory() as temp_dir:
            input_paths = []
            for f_id in input_ids:
                file_metadata_res = supabase.table("files").select("*").eq("id", f_id).single().execute()
                if not file_metadata_res.data:
                    raise Exception(f"File not found: {f_id}")
                file_metadata = file_metadata_res.data
                storage_key = file_metadata["storage_key"]
                storage_res = supabase.storage.from_("uploads").download(storage_key)
                if not storage_res:
                    raise Exception(f"Failed to download file: {file_metadata.get('filename', f_id)}")
                safe_filename = os.path.basename(file_metadata['filename'])
                safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', safe_filename)
                in_path = os.path.join(temp_dir, f"{f_id}_{safe_filename}")
                with open(in_path, "wb") as f:
                    f.write(storage_res)

                # Validate file exists and is readable
                if not os.path.exists(in_path) or os.path.getsize(in_path) == 0:
                    raise Exception(f"Downloaded file is empty or missing: {file_metadata.get('filename', f_id)}")

                input_paths.append(in_path)

            try:
                supabase.table("processing_jobs").update({"progress": 30}).eq("id", job_id).execute()
            except Exception:
                pass

            tool = job["tool"]
            success = False

            if tool == "Compress PDF":
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                target_size = job.get("configuration", {}).get("target_size_mb")
                success = PDFService.compress_pdf(input_paths[0], output_path, target_size)
            elif tool == "Split PDF":
                output_filename = f"processed_{job['id']}.zip"
                output_path = os.path.join(temp_dir, output_filename)
                split_config = job.get("configuration", {}) or {}
                split_page_num = split_config.get("split_page", 1)
                from PyPDF2 import PdfReader
                reader = PdfReader(input_paths[0])
                total_pages = len(reader.pages)
                ranges = [(1, split_page_num)]
                if total_pages > split_page_num:
                    ranges.append((split_page_num + 1, total_pages))
                out_files = PDFService.split_pdf(input_paths[0], temp_dir, ranges=ranges)
                if out_files:
                    with zipfile.ZipFile(output_path, 'w') as zipf:
                        for idx, file in enumerate(out_files):
                            zipf.write(file, f"part_{idx+1}.pdf")
                    success = True
            elif tool == "Text to Speech":
                output_filename = f"tts_{job['id']}.mp3"
                output_path = os.path.join(temp_dir, output_filename)
                text = job.get("configuration", {}).get("text", "")
                if not text:
                    raise Exception("No text provided for TTS")
                text = " ".join(text.split()[:600])
                from src.services.media_service import MediaService
                success = MediaService.text_to_speech(text, output_path)
            elif tool == "Profile Picture Maker":
                output_filename = f"profile_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                color = job.get("configuration", {}).get("color", "#6366f1")
                from src.services.image_service import ImageService
                success = ImageService.create_profile_picture(input_paths[0], output_path, color)
            elif tool == "QR Code Generator":
                output_filename = f"qrcode_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                url = job.get("configuration", {}).get("url", "https://uniconv-psi.vercel.app")
                from src.services.image_service import ImageService
                success = ImageService.generate_qr_code(url, output_path)
            elif tool == "Remove Background":
                output_filename = f"nobg_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.remove_background(input_paths[0], output_path)
            elif tool == "Compress Image":
                ext = os.path.splitext(input_paths[0])[1] or ".jpg"
                output_filename = f"compressed_{job['id']}{ext}"
                output_path = os.path.join(temp_dir, output_filename)
                target_size = job.get("configuration", {}).get("target_size_mb")
                from src.services.image_service import ImageService
                success = ImageService.compress_image(input_paths[0], output_path, target_size_mb=target_size)
            elif tool == "Merge PDF":
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.merge_pdfs(input_paths, output_path)
            elif tool == "PDF to Word":
                output_filename = f"processed_{job['id']}.docx"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.pdf_to_word(input_paths[0], output_path)
            elif tool == "PDF to Excel":
                output_filename = f"processed_{job['id']}.xlsx"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.pdf_to_excel(input_paths[0], output_path)
            elif tool == "PDF to PowerPoint":
                output_filename = f"processed_{job['id']}.pptx"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.pdf_to_pptx(input_paths[0], output_path)
            elif tool == "Extract Text (OCR)":
                output_filename = f"processed_{job['id']}.txt"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.extract_text_ocr(input_paths[0], output_path)
            elif tool == "PDF to JPG":
                output_filename = f"processed_{job['id']}.zip"
                output_path = os.path.join(temp_dir, output_filename)
                out_files = PDFService.pdf_to_jpg(input_paths[0], temp_dir)
                if out_files:
                    shutil.copy(out_files[0], output_path)
                    success = True
            elif tool == "JPG to PDF":
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.jpg_to_pdf(input_paths, output_path)
            elif tool == "Compress Video":
                output_filename = f"compressed_{job['id']}.mp4"
                output_path = os.path.join(temp_dir, output_filename)
                target_size = job.get("configuration", {}).get("target_size_mb")
                from src.services.media_service import MediaService
                success = MediaService.compress_video(input_paths[0], output_path, target_size_mb=target_size)
            elif tool == "Video to GIF":
                output_filename = f"converted_{job['id']}.gif"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.media_service import MediaService
                success = MediaService.video_to_gif(input_paths[0], output_path)
            elif tool == "HTML to PDF":
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                url_val = job.get("configuration", {}).get("url")
                if url_val:
                    success = PDFService.html_to_pdf(url_val, output_path, is_url=True)
                elif input_paths:
                    success = PDFService.html_to_pdf(input_paths[0], output_path, is_url=False)
                else:
                    raise Exception("No URL or HTML file provided")
            elif tool == "Extract Audio":
                output_filename = f"processed_{job['id']}.mp3"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.media_service import MediaService
                success = MediaService.extract_audio(input_paths[0], output_path)
            elif tool == "Audio Conversions":
                target_fmt = job.get("configuration", {}).get("target_format", "mp3")
                output_filename = f"processed_{job['id']}.{target_fmt}"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.media_service import MediaService
                success = MediaService.convert_audio(input_paths[0], output_path)
            elif tool == "Unlock PDF":
                output_filename = f"unlocked_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                password = job.get("configuration", {}).get("password", "")
                success = PDFService.unlock_pdf(input_paths[0], output_path, password)
            elif tool == "Image Resizer":
                output_filename = f"resized_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                cfg = job.get("configuration", {}) or {}
                from src.services.image_service import ImageService
                success = ImageService.resize_image(
                    input_paths[0], output_path,
                    width=cfg.get("width"), height=cfg.get("height"),
                    maintain_aspect=cfg.get("maintain_aspect", True)
                )
            elif tool == "Crop Image":
                output_filename = f"cropped_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                cfg = job.get("configuration", {}) or {}
                from src.services.image_service import ImageService
                success = ImageService.crop_image(
                    input_paths[0], output_path,
                    x=cfg.get("x", 0), y=cfg.get("y", 0),
                    width=cfg.get("width"), height=cfg.get("height")
                )
            elif tool == "Image to PNG":
                output_filename = f"converted_{job['id']}.png"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.convert_to_png(input_paths[0], output_path)
            elif tool == "Image to WEBP":
                output_filename = f"converted_{job['id']}.webp"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.convert_to_webp(input_paths[0], output_path)
            elif tool == "Rotate PDF":
                output_filename = f"rotated_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                cfg = job.get("configuration", {}) or {}
                angle = int(cfg.get("angle", 90))
                pages = cfg.get("pages")
                success = PDFService.rotate_pdf(input_paths[0], output_path, angle=angle, pages=pages)
            elif tool == "PDF Page Extractor":
                output_filename = f"extracted_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                cfg = job.get("configuration", {}) or {}
                start_page = int(cfg.get("start_page", 1))
                end_page = cfg.get("end_page")
                success = PDFService.extract_pages(input_paths[0], output_path, start_page=start_page, end_page=end_page)
            elif tool == "secure_pdf_password":
                output_filename = f"secured_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                password = job.get("configuration", {}).get("password", "")
                success = PDFService.secure_password(input_paths[0], output_path, password)
            elif tool == "secure_pdf_permissions":
                output_filename = f"secured_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                permissions = job.get("configuration", {}).get("permissions", {})
                success = PDFService.secure_permissions(input_paths[0], output_path, permissions)
            elif tool == "secure_pdf_watermark":
                output_filename = f"secured_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                config = job.get("configuration", {})
                success = PDFService.secure_watermark(input_paths[0], output_path, config)
            elif tool == "secure_pdf_redact":
                output_filename = f"secured_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                text_to_redact = job.get("configuration", {}).get("text", "")
                success = PDFService.secure_redact(input_paths[0], output_path, text_to_redact)
            elif tool == "secure_pdf_metadata":
                output_filename = f"secured_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                success = PDFService.remove_metadata(input_paths[0], output_path)
            elif tool == "Watermark Remover":
                ext = os.path.splitext(input_paths[0])[1] or ".jpg"
                output_filename = f"cleaned_{job['id']}{ext}"
                output_path = os.path.join(temp_dir, output_filename)
                position = job.get("configuration", {}).get("position", "bottom_right")
                from src.services.media_service import MediaService
                success = MediaService.remove_watermark(input_paths[0], output_path, position)
            elif tool in ["Word to PDF", "Excel to PDF", "PowerPoint to PDF"]:
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.media_service import MediaService
                success = MediaService.office_to_pdf(input_paths[0], output_path)
            else:
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                shutil.copy(input_paths[0], output_path)
                success = True

            if not success:
                raise Exception(f"Processing failed for tool: {tool}")

            try:
                supabase.table("processing_jobs").update({"progress": 70}).eq("id", job_id).execute()
            except Exception:
                pass

            content_type, _ = mimetypes.guess_type(output_filename)
            if not content_type:
                content_type = "application/octet-stream"

            with open(output_path, "rb") as f:
                supabase.storage.from_("results").upload(
                    path=output_filename,
                    file=f,
                    file_options={"content-type": content_type}
                )

            try:
                supabase.table("processing_jobs").update({"progress": 90}).eq("id", job_id).execute()
            except Exception:
                pass

            result_file_res = supabase.table("files").insert({
                "user_id": job.get("user_id"),
                "filename": output_filename,
                "original_filename": output_filename,
                "size_bytes": os.path.getsize(output_path),
                "storage_key": output_filename,
            }).execute()

            result_file_id = result_file_res.data[0]["id"]

            try:
                supabase.table("processing_jobs").update({
                    "status": "COMPLETED",
                    "progress": 100,
                    "result_file_id": result_file_id
                }).eq("id", job_id).execute()
            except Exception:
                supabase.table("processing_jobs").update({
                    "status": "COMPLETED",
                    "result_file_id": result_file_id
                }).eq("id", job_id).execute()

            print(f"Completed processing for job {job_id}")

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        try:
            supabase.table("processing_jobs").update({
                "status": "FAILED",
                "error_message": str(e),
                "progress": 0
            }).eq("id", job_id).execute()
        except Exception:
            try:
                supabase.table("processing_jobs").update({
                    "status": "FAILED",
                    "error_message": str(e)
                }).eq("id", job_id).execute()
            except Exception:
                pass

# --- Admin ---
class NotifyRequest(BaseModel):
    user_email: str
    plan_name: str

@app.post("/api/admin/notify-upgrade")
def notify_upgrade(req: NotifyRequest):
    from src.services.email_service import EmailService
    success = EmailService.send_upgrade_email(req.user_email, req.plan_name)
    if success:
        return {"status": "success", "message": "Email sent"}
    raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP configuration.")
