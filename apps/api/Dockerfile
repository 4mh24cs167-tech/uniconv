# Use the official Python 3.11 image as the base
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies: ffmpeg (for video/audio), libreoffice (for office to pdf), and libgl1 (for OpenCV)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libreoffice \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the FastAPI backend code into the container
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the FastAPI application using Uvicorn
# Make sure we point to src.main:app since the code is inside the src folder
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
