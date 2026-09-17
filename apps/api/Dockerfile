# Use the stable Debian bookworm Python image
FROM python:3.11-slim-bookworm

# Disable numba caching (needed for rembg to import correctly during Docker build)
ENV NUMBA_DISABLE_CACHING=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies: ffmpeg (for video/audio), libreoffice (for office to pdf), libgl1 (for OpenCV), and tesseract-ocr (for OCR text extraction)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libreoffice \
    libgl1 \
    libglib2.0-0 \
    tesseract-ocr \
    wkhtmltopdf \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the FastAPI backend code into the container
COPY . .

# Create a non-root user and switch to it
RUN useradd -r appuser && chown -R appuser /app
USER appuser

# Pre-download the rembg U2Net ONNX model as appuser so it's cached at runtime
RUN python -c "from rembg.session_factory import new_session; new_session('u2net')"

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the FastAPI application using Uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
