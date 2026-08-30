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
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
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
                # Video: Use FFmpeg delogo
                # Calculate x, y based on position
                # W=iw, H=ih, w=iw*0.25, h=ih*0.15
                if position == "top_left":
                    vf = "delogo=x=0:y=0:w=iw*0.25:h=ih*0.15"
                elif position == "top_right":
                    vf = "delogo=x=iw-iw*0.25:y=0:w=iw*0.25:h=ih*0.15"
                elif position == "bottom_left":
                    vf = "delogo=x=0:y=ih-ih*0.15:w=iw*0.25:h=ih*0.15"
                elif position == "center":
                    vf = "delogo=x=iw/2-iw*0.125:y=ih/2-ih*0.075:w=iw*0.25:h=ih*0.15"
                else: # bottom_right
                    vf = "delogo=x=iw-iw*0.25:y=ih-ih*0.15:w=iw*0.25:h=ih*0.15"
                    
                command = [
                    "ffmpeg", "-y", "-i", input_path,
                    "-vf", vf,
                    "-c:a", "copy",
                    output_path
                ]
                subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                return True
            else:
                import cv2
                import numpy as np
                
                img = cv2.imread(input_path)
                if img is None:
                    raise Exception("Could not read image for watermark removal")
                    
                h, w = img.shape[:2]
                mask = np.zeros((h, w), dtype=np.uint8)
                
                mask_h = int(h * 0.15)
                mask_w = int(w * 0.25)
                
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
            command = [
                "ffmpeg", "-y", "-i", input_path,
                "-vn", # Disable video just in case
                output_path
            ]
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
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
                subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except FileNotFoundError:
                command[0] = "soffice"
                subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
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
