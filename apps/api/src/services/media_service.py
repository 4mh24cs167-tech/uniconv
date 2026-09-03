import os
import subprocess

class MediaService:
    @staticmethod
    def extract_audio(input_path: str, output_path: str) -> bool:
        """
        Extracts audio from a video file using raw FFmpeg.
        """
        try:
            command = [
                "ffmpeg", "-y", "-i", input_path,
                "-q:a", "0", "-map", "a",
                output_path
            ]
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception as e:
            print(f"Error extracting audio: {e}")
            return False

    @staticmethod
    def remove_watermark(input_path: str, output_path: str, position: str = "bottom_right") -> bool:
        """
        Removes watermark. Uses OpenCV inpainting for images, and FFmpeg delogo for videos.
        """
        try:
            ext = os.path.splitext(input_path)[1].lower()
            if ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
                # Video: Use FFmpeg delogo - must probe dimensions first
                import json as _json
                probe_cmd = [
                    "ffprobe", "-v", "quiet", "-print_format", "json",
                    "-show_streams", "-select_streams", "v:0", input_path
                ]
                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
                probe_data = _json.loads(probe_result.stdout)
                vw = int(probe_data["streams"][0]["width"])
                vh = int(probe_data["streams"][0]["height"])
                
                logo_w = max(int(vw * 0.35), 1)
                logo_h = max(int(vh * 0.20), 1)
                
                if position == "top_left":
                    lx, ly = 0, 0
                elif position == "top_right":
                    lx, ly = vw - logo_w, 0
                elif position == "bottom_left":
                    lx, ly = 0, vh - logo_h
                elif position == "center":
                    lx, ly = vw // 2 - logo_w // 2, vh // 2 - logo_h // 2
                else: # bottom_right
                    lx, ly = vw - logo_w, vh - logo_h
                
                # FFMPEG delogo sometimes crashes if boundaries exactly match width/height
                # Pad inwards by 2 pixels to guarantee we stay inside the bounding box
                lx = max(2, lx)
                ly = max(2, ly)
                if lx + logo_w >= vw:
                    logo_w = vw - lx - 2
                if ly + logo_h >= vh:
                    logo_h = vh - ly - 2
                    
                vf = f"delogo=x={lx}:y={ly}:w={logo_w}:h={logo_h}"
                command = [
                    "ffmpeg", "-y", "-i", input_path,
                    "-vf", vf,
                    "-c:a", "copy",
                    output_path
                ]
                # Capture output to help debug if it fails again
                res = subprocess.run(command, capture_output=True, text=True)
                if res.returncode != 0:
                    print(f"FFMPEG ERROR: {res.stderr}")
                    return False
                return True
            else:
                import cv2
                import numpy as np
                
                img = cv2.imread(input_path)
                if img is None:
                    raise Exception("Could not read image for watermark removal")
                    
                h, w = img.shape[:2]
                mask = np.zeros((h, w), dtype=np.uint8)
                
                mask_h = int(h * 0.20)
                mask_w = int(w * 0.35)
                
                if position == "top_left":
                    mask[0:mask_h, 0:mask_w] = 255
                elif position == "top_right":
                    mask[0:mask_h, w - mask_w:] = 255
                elif position == "bottom_left":
                    mask[h - mask_h:, 0:mask_w] = 255
                elif position == "center":
                    y1 = int(h/2 - mask_h/2)
                    x1 = int(w/2 - mask_w/2)
                    mask[y1:y1+mask_h, x1:x1+mask_w] = 255
                else: # bottom_right
                    mask[h - mask_h:, w - mask_w:] = 255
                
                result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
                cv2.imwrite(output_path, result)
                return True
        except Exception as e:
            print(f"Error removing watermark: {e}")
            return False

    @staticmethod
    def convert_audio(input_path: str, output_path: str) -> bool:
        """
        Transcodes audio from one format to another using FFmpeg.
        """
        try:
            ext = os.path.splitext(output_path)[1].lower()
            codec_args = []
            if ext == ".mp3":
                codec_args = ["-c:a", "libmp3lame", "-q:a", "2"]
            elif ext in [".ogg", ".oga"]:
                codec_args = ["-c:a", "libvorbis", "-q:a", "4"]
            elif ext in [".m4a", ".aac"]:
                codec_args = ["-c:a", "aac", "-b:a", "192k"]
            elif ext == ".wav":
                codec_args = ["-c:a", "pcm_s16le"]
            elif ext == ".flac":
                codec_args = ["-c:a", "flac"]
            elif ext == ".wma":
                codec_args = ["-c:a", "wmav2"]
                
            command = [
                "ffmpeg", "-y", "-i", input_path,
                "-vn"
            ] + codec_args + [output_path]
            
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception as e:
            print(f"Error converting audio: {e}")
            return False

    @staticmethod
    def office_to_pdf(input_path: str, output_path: str) -> bool:
        """
        Converts Office files to PDF using LibreOffice headless.
        Requires 'libreoffice' or 'soffice' installed on the system.
        """
        try:
            out_dir = os.path.dirname(output_path)
            # Run libreoffice headless conversion
            # e.g., libreoffice --headless --convert-to pdf file.docx --outdir /tmp
            command = [
                "libreoffice", "--headless", "--convert-to", "pdf",
                input_path, "--outdir", out_dir
            ]
            
            # On some systems, the command is 'soffice'
            try:
                subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except FileNotFoundError:
                command[0] = "soffice"
                subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
            # Libreoffice names the output file the same as input but with .pdf
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            expected_out = os.path.join(out_dir, f"{base_name}.pdf")
            
            if os.path.exists(expected_out):
                os.rename(expected_out, output_path)
                return True
            return False
        except Exception as e:
            print(f"Error converting office to PDF: {e}")
            return False
