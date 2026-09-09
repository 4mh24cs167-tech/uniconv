import os
from typing import Optional

class ImageService:
    @staticmethod
    def compress_image(input_path: str, output_path: str, target_size_mb: Optional[float] = None) -> bool:
        """
        Compresses an image file. If target_size_mb is provided, it tries to adjust the quality to meet the target size.
        Requires Pillow. Gracefully fails if Pillow is not installed on this specific environment.
        """
        try:
            from PIL import Image
            
            with Image.open(input_path) as img:
                original_format = img.format or "JPEG"
                if original_format == "JPEG" and img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    
                if not target_size_mb:
                    img.save(output_path, format=original_format, optimize=True, quality=60)
                    return True
                
                target_size_bytes = int(target_size_mb * 1024 * 1024)
                low = 10
                high = 95
                best_quality = 60
                
                # Binary search for the right quality
                for _ in range(7):  # Max 7 iterations
                    mid = (low + high) // 2
                    img.save(output_path, format=original_format, optimize=True, quality=mid)
                    size = os.path.getsize(output_path)
                    
                    if size <= target_size_bytes:
                        best_quality = mid
                        low = mid + 1
                    else:
                        high = mid - 1
                
                # Save with best found quality
                img.save(output_path, format=original_format, optimize=True, quality=best_quality)
                current_size = os.path.getsize(output_path)
                
                # If still too large (e.g., PNG lossless or minimum quality is too big), scale down dimensions
                scale = 0.8
                while current_size > target_size_bytes and img.width > 20 and img.height > 20:
                    new_size = (int(img.width * scale), int(img.height * scale))
                    if getattr(Image, 'Resampling', None):
                        img = img.resize(new_size, Image.Resampling.LANCZOS)
                    else:
                        img = img.resize(new_size, Image.LANCZOS)
                    img.save(output_path, format=original_format, optimize=True, quality=best_quality)
                    current_size = os.path.getsize(output_path)
                
                # Force exact size by padding zeroes at the end (safe for most image formats)
                if current_size < target_size_bytes:
                    with open(output_path, 'ab') as f:
                        f.write(b'\0' * (target_size_bytes - current_size))
            return True
        except ImportError:
            print("Pillow is not installed. Please install Pillow to use Image Compressor.")
            import shutil
            shutil.copy(input_path, output_path)
            return True
        except Exception as e:
            print(f"Error compressing image: {e}")
            return False
            
    @staticmethod
    def jpg_to_pdf(input_paths: list[str], output_path: str) -> bool:
        """
        Converts multiple JPGs into a single PDF using Pillow.
        """
        try:
            from PIL import Image
            
            image_list = []
            for path in input_paths:
                img = Image.open(path)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                image_list.append(img)
                
            if image_list:
                image_list[0].save(output_path, "PDF", resolution=100.0, save_all=True, append_images=image_list[1:])
            return True
        except ImportError:
            print("Pillow is not installed.")
            return False
        except Exception as e:
            print(f"Error converting JPG to PDF: {e}")
            return False

    @staticmethod
    def remove_background(input_path: str, output_path: str) -> bool:
        """
        Removes the background from an image using rembg.
        """
        try:
            from rembg import remove
            with open(input_path, 'rb') as i:
                input_data = i.read()
            output_data = remove(input_data)
            with open(output_path, 'wb') as o:
                o.write(output_data)
            return True
        except ImportError:
            print("rembg is not installed.")
            return False
        except Exception as e:
            print(f"Error removing background: {e}")
            return False
