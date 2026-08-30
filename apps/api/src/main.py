import os
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Document Productivity API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")

# We initialize a global Supabase client (using anon key or service role).
# For secure routes, we will verify the user's JWT from the request header.
supabase: Client = create_client(url, key) if url and key else None

# --- APScheduler Setup for Cleanup ---
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, timezone

def cleanup_old_files():
    """
    Deletes files and jobs older than 24 hours from Supabase to save storage space.
    """
    try:
        if not supabase:
            return
            
        print("Running scheduled cleanup job for old files...")
        threshold_date = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        
        # Find old files
        old_files = supabase.table("files").select("id, storage_key").lt("created_at", threshold_date).execute()
        
        if old_files.data:
            print(f"Found {len(old_files.data)} old files to delete.")
            
            # Delete from Storage buckets
            for file in old_files.data:
                key = file.get("storage_key")
                if key:
                    # Try to delete from both buckets since we don't track which one it's in here
                    try:
                        supabase.storage.from_("uploads").remove([key])
                        supabase.storage.from_("results").remove([key])
                    except Exception as e:
                        print(f"Failed to delete storage key {key}: {e}")
            
            # Delete from DB
            file_ids = [f["id"] for f in old_files.data]
            # Batch delete in chunks of 50 if needed, but for simplicity:
            supabase.table("files").delete().in_("id", file_ids).execute()
            
        print("Cleanup job finished.")
    except Exception as e:
        print(f"Error during cleanup job: {e}")

# Start the scheduler when the app boots
scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_files, 'interval', hours=12) # Run every 12 hours
scheduler.start()
# -----------------------------------

@app.get("/")
def read_root():
    return {"message": "Document Productivity API is running"}

# --- Razorpay Setup ---
import razorpay
from fastapi import Request, Header

RZP_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RZP_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RZP_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

razorpay_client = razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET)) if RZP_KEY_ID and RZP_KEY_SECRET else None

class RazorpayOrderRequest(BaseModel):
    plan_id: str
    user_id: str

@app.post("/api/subscriptions/create-order")
async def create_razorpay_order(req: RazorpayOrderRequest):
    """
    Creates a Razorpay order for the requested plan.
    """
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured on server")
        
    # Map plan to amount (in smallest currency unit, e.g., cents/paise)
    plan_prices = {
        "pro": 499, # $4.99 -> 499 cents
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
    """
    Handles successful payment webhooks to auto-upgrade users.
    """
    if not razorpay_client or not RZP_WEBHOOK_SECRET:
        return {"status": "ignored", "reason": "Razorpay not configured"}
        
    body = await request.body()
    
    try:
        # Verify webhook signature
        razorpay_client.utility.verify_webhook_signature(
            body.decode("utf-8"),
            x_razorpay_signature,
            RZP_WEBHOOK_SECRET
        )
        
        payload = await request.json()
        event = payload.get("event")
        
        if event == "payment.captured" or event == "order.paid":
            # Extract notes to find user_id and plan_id
            payment_entity = payload["payload"].get("payment", {}).get("entity", {})
            notes = payment_entity.get("notes", {})
            
            user_id = notes.get("user_id")
            plan_id = notes.get("plan_id")
            
            if user_id and plan_id:
                # Update user in DB
                supabase.table("users").update({
                    "plan": plan_id.lower(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", user_id).execute()
                
                print(f"Automatically upgraded user {user_id} to {plan_id} via Webhook!")
                
        return {"status": "success"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class JobRequest(BaseModel):
    tool: str
    target_format: Optional[str] = None
    target_size_mb: Optional[float] = None
    input_file_ids: Optional[list[str]] = None
    configuration: Optional[dict] = None

@app.post("/api/jobs")
async def create_job(
    request: JobRequest,
    file_id: str,
    user_id: Optional[str] = None, # Passed from frontend via auth token in reality
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    1. Authenticate user (guest or registered)
    2. Check limits (file size, daily ops)
    3. Create job in DB
    4. Enqueue background task
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    # --- LIMIT CHECKING LOGIC ---
    # 1. Fetch file metadata
    file_res = supabase.table("files").select("size_bytes").eq("id", file_id).execute()
    if not file_res.data:
        raise HTTPException(status_code=404, detail="File not found")
    file_size = file_res.data[0]["size_bytes"]

    # 2. Determine limits based on User Plan
    max_file_size = 350 * 1024 * 1024 # 350MB default for Free/Guest
    
    if user_id:
        user_res = supabase.table("users").select("plan_id").eq("id", user_id).execute()
        if user_res.data:
            user_data = user_res.data[0]
            if user_data.get("plan_id"):
                plan_res = supabase.table("plans").select("max_file_size_bytes").eq("id", user_data["plan_id"]).execute()
                
                if plan_res.data:
                    plan = plan_res.data[0]
                    # If max_file_size_bytes is very large or null, treat as unlimited (Premium)
                    if plan["max_file_size_bytes"] > 0:
                        max_file_size = plan["max_file_size_bytes"]
                    else:
                        max_file_size = float('inf')

    # 3. Check File Size Limit
    if file_size > max_file_size:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size for your tier. ({max_file_size / (1024*1024)}MB)")
    
    # Extract input files array
    input_ids = request.input_file_ids if request.input_file_ids else [file_id]
    
    # ---------------------------
    
    # Create Job in DB
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
        "status": "QUEUED"
    }
    
    if user_id:
        job_data["user_id"] = user_id
    
    try:
        response = supabase.table("processing_jobs").insert(job_data).execute()
        job = response.data[0]
        
        # Enqueue background processing
        background_tasks.add_task(process_document_job, job["id"])
        
        return {"job_id": job["id"], "status": "QUEUED"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
async def process_document_job(job_id: str):
    """
    Background worker that:
    1. Downloads file from Supabase Storage
    2. Runs processing (compression, OCR, conversion)
    3. Verifies output
    4. Uploads result to Storage
    5. Updates job status to COMPLETED
    """
    try:
        import asyncio
        import os
        import tempfile
        from src.services.pdf_service import PDFService
        
        print(f"Starting processing for job {job_id}")
        
        # Update status to PROCESSING
        supabase.table("processing_jobs").update({"status": "PROCESSING"}).eq("id", job_id).execute()
        
        # 1. Fetch Job and Input Files Metadata
        job_res = supabase.table("processing_jobs").select("*").eq("id", job_id).single().execute()
        job = job_res.data
        
        input_ids = job["input_file_ids"]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            input_paths = []
            
            for f_id in input_ids:
                file_metadata_res = supabase.table("files").select("*").eq("id", f_id).single().execute()
                file_metadata = file_metadata_res.data
                storage_key = file_metadata["storage_key"]
                
                # 2. Download from Supabase Storage
                storage_res = supabase.storage.from_("uploads").download(storage_key)
                in_path = os.path.join(temp_dir, f"{f_id}_{file_metadata['filename']}")
                with open(in_path, "wb") as f:
                    f.write(storage_res)
                input_paths.append(in_path)
                
            # 3. Process based on tool
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
                
                split_page = job.get("configuration", {})
                if not split_page:
                    split_page = {}
                split_page_num = split_page.get("split_page", 1)
                
                from PyPDF2 import PdfReader
                reader = PdfReader(input_paths[0])
                total_pages = len(reader.pages)
                
                ranges = [(1, split_page_num)]
                if total_pages > split_page_num:
                    ranges.append((split_page_num + 1, total_pages))
                    
                out_files = PDFService.split_pdf(input_paths[0], temp_dir, ranges=ranges)
                
                if out_files:
                    import zipfile
                    with zipfile.ZipFile(output_path, 'w') as zipf:
                        for idx, file in enumerate(out_files):
                            zipf.write(file, f"part_{idx+1}.pdf")
                    success = True
            elif tool == "Compress JPG":
                output_filename = f"processed_{job['id']}.jpg"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.compress_jpg(input_paths[0], output_path, quality=50)
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
                    import shutil
                    shutil.copy(out_files[0], output_path)
                    success = True
            elif tool == "JPG to PDF":
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.image_service import ImageService
                success = ImageService.jpg_to_pdf(input_paths, output_path)
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
                from src.services.media_service import MediaService
                success = MediaService.remove_watermark(input_paths[0], output_path)
            elif tool in ["Word to PDF", "Excel to PDF", "PowerPoint to PDF"]:
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                from src.services.media_service import MediaService
                success = MediaService.office_to_pdf(input_paths[0], output_path)
            else:
                output_filename = f"processed_{job['id']}.pdf"
                output_path = os.path.join(temp_dir, output_filename)
                import shutil
                shutil.copy(input_paths[0], output_path)
                success = True
                
            if not success:
                raise Exception(f"Processing failed for tool: {tool}")
                
            # 4. Upload Result to Supabase Storage
            import mimetypes
            content_type, _ = mimetypes.guess_type(output_filename)
            if not content_type:
                content_type = "application/octet-stream"
                
            with open(output_path, "rb") as f:
                upload_res = supabase.storage.from_("results").upload(
                    path=output_filename,
                    file=f,
                    file_options={"content-type": content_type} 
                )
                
            # 5. Create Result File Record in DB
            result_file_res = supabase.table("files").insert({
                "user_id": job["user_id"],
                "filename": output_filename,
                "original_filename": output_filename,
                "size_bytes": os.path.getsize(output_path),
                "storage_key": output_filename,
            }).execute()
            
            result_file_id = result_file_res.data[0]["id"]
            
            # 5. Update job status to COMPLETED
            supabase.table("processing_jobs").update({
                "status": "COMPLETED", 
                "progress": 100,
                "result_file_id": result_file_id
            }).eq("id", job_id).execute()
            
            print(f"Completed processing for job {job_id}")
            
    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        supabase.table("processing_jobs").update({
            "status": "FAILED",
            "error_message": str(e)
        }).eq("id", job_id).execute()

class NotifyRequest(BaseModel):
    user_email: str
    plan_name: str

@app.post("/api/admin/notify-upgrade")
def notify_upgrade(req: NotifyRequest):
    """
    Sends an upgrade confirmation email to the user.
    """
    from src.services.email_service import EmailService
    success = EmailService.send_upgrade_email(req.user_email, req.plan_name)
    if success:
        return {"status": "success", "message": "Email sent"}
    raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP configuration.")
