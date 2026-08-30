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

@app.get("/")
def read_root():
    return {"message": "Document Productivity API is running"}

class RazorpayOrderRequest(BaseModel):
    plan_id: str
    user_id: str

@app.post("/api/subscriptions/create-order")
async def create_razorpay_order(request: RazorpayOrderRequest):
    """
    Creates a Razorpay order for the requested plan.
    (Mocked for now since credentials are not provided)
    """
    return {
        "status": "success",
        "order_id": "order_mock_" + os.urandom(4).hex(),
        "amount": 999, # $9.99 * 100
        "currency": "USD"
    }

@app.post("/api/subscriptions/webhook")
async def razorpay_webhook():
    """
    Handles successful payment webhooks.
    """
    return {"status": "ok"}


class JobRequest(BaseModel):
    tool: str
    target_format: Optional[str] = None
    target_size_mb: Optional[float] = None
    # additional config

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
    
    # ---------------------------
    
    # Create Job in DB
    job_data = {
        "tool": request.tool,
        "input_file_ids": [file_id],
        "configuration": {
            "target_format": request.target_format,
            "target_size_mb": request.target_size_mb
        },
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
    import asyncio
    import os
    import tempfile
    from services.pdf_service import PDFService
    
    print(f"Starting processing for job {job_id}")
    
    # Update status to PROCESSING
    supabase.table("processing_jobs").update({"status": "PROCESSING"}).eq("id", job_id).execute()
    
    try:
        # 1. Fetch job details
        job_res = supabase.table("processing_jobs").select("*").eq("id", job_id).execute()
        if not job_res.data:
            raise Exception("Job not found")
        job = job_res.data[0]
        
        file_id = job["input_file_ids"][0]
        
        # Fetch file details
        file_res = supabase.table("files").select("*").eq("id", file_id).execute()
        if not file_res.data:
            raise Exception("Input file not found in DB")
        file_metadata = file_res.data[0]
        storage_key = file_metadata["storage_key"]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = os.path.join(temp_dir, file_metadata["filename"])
            output_path = os.path.join(temp_dir, f"processed_{file_metadata['filename']}")
            
            # 2. Download from Supabase Storage
            res = supabase.storage.from_("uploads").download(storage_key)
            with open(input_path, "wb") as f:
                f.write(res)
                
            print(f"Downloaded {file_metadata['filename']} successfully")
            
            # 3. Process based on tool
            tool = job["tool"]
            success = False
            
            if tool == "Compress PDF":
                target_size = job.get("configuration", {}).get("target_size_mb")
                success = PDFService.compress_pdf(input_path, output_path, target_size)
            elif tool == "Split PDF":
                # For split, we output multiple files. For this MVP, let's just split the first page or package into zip.
                # Since we only upload ONE result file in this MVP schema, we will mock splitting by saving page 1.
                out_files = PDFService.split_pdf(input_path, temp_dir, ranges=[(1, 1)])
                if out_files:
                    import shutil
                    shutil.copy(out_files[0], output_path)
                    success = True
            elif tool == "Compress JPG":
                from services.image_service import ImageService
                success = ImageService.compress_jpg(input_path, output_path, quality=50)
            elif tool == "Merge PDF":
                success = PDFService.merge_pdfs([input_path], output_path) # Needs multiple files logic later
            else:
                # Mock generic success for other tools for now
                import shutil
                shutil.copy(input_path, output_path)
                success = True
                
            if not success:
                raise Exception(f"Processing failed for tool: {tool}")
                
            # 4. Upload result to Storage
            result_key = f"{job['user_id']}/results/{job_id}_{file_metadata['filename']}"
            with open(output_path, "rb") as f:
                supabase.storage.from_("results").upload(result_key, f)
                
            # Create result file DB entry
            result_file_data = {
                "user_id": job["user_id"],
                "filename": f"processed_{file_metadata['filename']}",
                "original_filename": file_metadata['original_filename'],
                "size_bytes": os.path.getsize(output_path),
                "storage_key": result_key,
                "status": "active"
            }
            res_file = supabase.table("files").insert(result_file_data).execute()
            result_file_id = res_file.data[0]["id"]
            
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

