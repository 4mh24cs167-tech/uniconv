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

class JobRequest(BaseModel):
    tool: str
    target_format: Optional[str] = None
    target_size_mb: Optional[float] = None
    # additional config

@app.post("/api/jobs")
async def create_job(
    request: JobRequest,
    file_id: str,
    background_tasks: BackgroundTasks
):
    """
    1. Authenticate user (guest or registered)
    2. Check limits (file size, daily ops)
    3. Create job in DB
    4. Enqueue background task
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    # TODO: Implement Limit Checking & Auth Verification
    
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
    
    try:
        response = supabase.table("processing_jobs").insert(job_data).execute()
        job = response.data[0]
        
        # Enqueue background processing (simulating Celery/Redis for native Windows)
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
    print(f"Starting processing for job {job_id}")
    
    # Update status to PROCESSING
    supabase.table("processing_jobs").update({"status": "PROCESSING"}).eq("id", job_id).execute()
    
    # SIMULATE HEAVY PROCESSING
    await asyncio.sleep(3)
    
    # Update status to COMPLETED
    supabase.table("processing_jobs").update({"status": "COMPLETED", "progress": 100}).eq("id", job_id).execute()
    print(f"Completed processing for job {job_id}")

