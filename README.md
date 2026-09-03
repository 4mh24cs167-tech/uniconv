# UniConv | The Ultimate File Converter

UniConv is a full-stack, universally accessible file conversion and manipulation platform. It allows users to convert, merge, compress, secure, and edit PDFs, images, and audio files instantly directly from their browser.

## 🚀 Features

- **Universal Converter:** Convert between major image formats (PNG, JPG, WEBP) and document formats (PDF, DOCX).
- **PDF to Excel:** Intelligent extraction of tables from PDFs into clean Excel sheets using `pdfplumber`.
- **Watermark Remover:** AI/CV-powered tool to automatically detect and blur/inpaint watermarks from videos and images.
- **Secure PDF:** Add passwords, apply 256-bit AES encryption permissions, redact sensitive text, and stamp watermarks.
- **Audio Conversions:** Extract audio from videos or convert audio formats (MP3, WAV, OGG, AAC) with exact FFmpeg codec control.
- **Merge & Split PDF:** Easily combine multiple PDFs or split large documents into individual pages.
- **Authentication & Pro Tiers:** Secure login via Supabase, with an upgraded PRO tier offering higher file limits and dark mode.
- **Google AdSense Integrated:** Monetized with Google Auto-ads.

## 🛠 Tech Stack

### Frontend (Web)
- **Framework:** Next.js 16 (App Router), React
- **Styling:** Tailwind CSS, Framer Motion (Animations), Lucide (Icons)
- **State/Auth:** Supabase Auth SSR
- **Hosting:** Vercel

### Backend (API)
- **Framework:** Python, FastAPI
- **Libraries:** PyMuPDF (`fitz`), `pdfplumber`, `ffmpeg-python`, OpenCV (`cv2`), `docx2pdf`
- **Hosting:** Render (Dockerized)
- **Storage:** Supabase Storage (S3-compatible)

## 💻 Local Development Setup

To run this project locally, you will need to set up both the Frontend and the Backend.

### 1. Supabase & Environment Variables
Create a Supabase project and get your API keys.

**Frontend (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Backend (`apps/api/.env`):**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
```

### 2. Frontend Setup
Navigate to the web application directory and start the Next.js dev server.
```bash
cd apps/web
npm install
npm run dev
```
The frontend will be available at `http://localhost:3000`.

### 3. Backend Setup
Navigate to the API directory. You must have Python 3.10+ and FFmpeg installed on your machine.
```bash
cd apps/api
python -m venv venv

# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```
The backend will be available at `http://localhost:8000`.

## 🐳 Docker Deployment (Backend)
The backend is fully containerized for deployment on Render.
```bash
cd apps/api
docker build -t uniconv-api .
docker run -p 8000:8000 uniconv-api
```

## 📝 License
Proprietary. All rights reserved.
