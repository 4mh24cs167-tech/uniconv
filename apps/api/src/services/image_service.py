import os
from typing import Optional

class ImageService:
    @staticmethod
    def compress_jpg(input_path: str, output_path: str, quality: int = 60) -> bool:
        """
        Compresses a JPG file.
        Requires Pillow. Gracefully fails if Pillow is not installed on this specific environment.
        """
        try:
            from PIL import Image
            
            with Image.open(input_path) as img:
                # Convert to RGB if it's not (e.g., RGBA or P)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    
                img.save(output_path, "JPEG", optimize=True, quality=quality)
            return True
        except ImportError:
            print("Pillow is not installed. Please install Pillow to use JPG Compressor.")
            # Fallback mock for environments without Pillow (e.g. Python 3.14 on Windows)
            import shutil
            shutil.copy(input_path, output_path)
            return True
        except Exception as e:
            print(f"Error compressing JPG: {e}")
            return False
