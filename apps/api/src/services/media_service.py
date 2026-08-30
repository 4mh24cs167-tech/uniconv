import os
import subprocess

class MediaService:
    @staticmethod
    def extract_audio(input_path: str, output_path: str) -> bool:
        """
        Extracts audio from a video file using moviepy (which relies on ffmpeg).
        """
        try:
            from moviepy.editor import VideoFileClip
            video = VideoFileClip(input_path)
            audio = video.audio
            if audio:
                audio.write_audiofile(output_path, logger=None)
                audio.close()
            video.close()
            return True
        except ImportError:
            print("moviepy is not installed.")
            return False
        except Exception as e:
            print(f"Error extracting audio: {e}")
            return False

    @staticmethod
    def remove_watermark(input_path: str, output_path: str) -> bool:
        """
        Naive watermark removal using OpenCV inpainting.
        Assumes the watermark is in the bottom right corner.
        For production, this would use a deep learning model.
        """
        try:
            import cv2
            import numpy as np
            
            img = cv2.imread(input_path)
            if img is None:
                raise Exception("Could not read image for watermark removal")
                
            h, w = img.shape[:2]
            
            # Create a mask for the bottom right corner
            mask = np.zeros((h, w), dtype=np.uint8)
            
            # Assume watermark is in the bottom right 20% width and 10% height
            mask_h = int(h * 0.10)
            mask_w = int(w * 0.20)
            mask[h - mask_h:, w - mask_w:] = 255
            
            # Inpaint
            result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
            
            cv2.imwrite(output_path, result)
            return True
        except ImportError:
            print("opencv-python-headless not installed.")
            return False
        except Exception as e:
            print(f"Error removing watermark: {e}")
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
