import os
from typing import Optional

class ImageService:
    @staticmethod
    def resize_image(input_path: str, output_path: str, width: Optional[int] = None, height: Optional[int] = None, maintain_aspect: bool = True) -> bool:
        """
        Resizes an image. If only width or height is given, the other dimension is calculated from aspect ratio.
        If both are given and maintain_aspect is True, width is used as the primary dimension.
        """
        try:
            from PIL import Image

            with Image.open(input_path) as img:
                orig_w, orig_h = img.size

                if not width and not height:
                    # No resize needed, just copy
                    img.save(output_path, format=img.format or "PNG")
                    return True

                if maintain_aspect:
                    if width and not height:
                        height = int(orig_h * (width / orig_w))
                    elif height and not width:
                        width = int(orig_w * (height / orig_h))
                    elif width and height:
                        # Both given: fit within bounds
                        ratio = min(width / orig_w, height / orig_h)
                        width = int(orig_w * ratio)
                        height = int(orig_h * ratio)
                else:
                    width = width or orig_w
                    height = height or orig_h

                width = max(1, width)
                height = max(1, height)

                resized = img.resize((width, height), Image.LANCZOS)
                resized.save(output_path, format=img.format or "PNG")
            return True
        except ImportError:
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"Image resize failed: {e}")

    @staticmethod
    def crop_image(input_path: str, output_path: str, x: int = 0, y: int = 0, width: Optional[int] = None, height: Optional[int] = None) -> bool:
        """
        Crops an image to the given rectangle (x, y, width, height).
        """
        try:
            from PIL import Image

            with Image.open(input_path) as img:
                img_w, img_h = img.size
                crop_w = width or img_w - x
                crop_h = height or img_h - y
                # Clamp to image bounds
                x = max(0, min(x, img_w - 1))
                y = max(0, min(y, img_h - 1))
                right = min(x + crop_w, img_w)
                bottom = min(y + crop_h, img_h)
                cropped = img.crop((x, y, right, bottom))
                cropped.save(output_path, format=img.format or "PNG")
            return True
        except ImportError:
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"Image crop failed: {e}")

    @staticmethod
    def convert_to_png(input_path: str, output_path: str) -> bool:
        """
        Converts any image to PNG format.
        """
        try:
            from PIL import Image

            with Image.open(input_path) as img:
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGBA")
                elif img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                img.save(output_path, "PNG")
            return True
        except ImportError:
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"Image to PNG conversion failed: {e}")

    @staticmethod
    def convert_to_webp(input_path: str, output_path: str, quality: int = 85) -> bool:
        """
        Converts any image to WEBP format.
        """
        try:
            from PIL import Image

            with Image.open(input_path) as img:
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGBA")
                elif img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                img.save(output_path, "WEBP", quality=quality)
            return True
        except ImportError:
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"Image to WEBP conversion failed: {e}")

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
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"Image compression failed: {e}")
            
    @staticmethod
    def jpg_to_pdf(input_paths: list[str], output_path: str) -> bool:
        """
        Converts multiple JPGs into a single PDF using Pillow.
        """
        try:
            from PIL import Image

            image_list = []
            for path in input_paths:
                with Image.open(path) as img:
                    if img.mode in ("RGBA", "P"):
                        loaded_img = img.convert("RGB")
                    else:
                        loaded_img = img.copy()
                    image_list.append(loaded_img)

            if image_list:
                image_list[0].save(output_path, "PDF", resolution=100.0, save_all=True, append_images=image_list[1:])
            return True
        except ImportError:
            raise Exception("Pillow is not installed on the server")
        except Exception as e:
            raise Exception(f"JPG to PDF conversion failed: {e}")

    @staticmethod
    def remove_background(input_path: str, output_path: str) -> bool:
        """
        Removes the background from an image using rembg.
        """
        try:
            from rembg import remove
            from rembg.session_factory import new_session
            session = new_session('u2net')
            with open(input_path, 'rb') as i:
                input_data = i.read()
            output_data = remove(input_data, session=session)
            with open(output_path, 'wb') as o:
                o.write(output_data)
            return True
        except ImportError:
            print("rembg is not installed. Install with: pip install rembg")
            raise Exception("Background removal library (rembg) is not installed on the server")
        except Exception as e:
            print(f"Error removing background: {e}")
            raise Exception(f"Background removal failed: {e}")

    @staticmethod
    def create_profile_picture(input_path: str, output_path: str, bg_color: str = "#FF5733") -> bool:
        """
        Removes background and adds a colored circular background.
        """
        try:
            from rembg import remove
            from rembg.session_factory import new_session
            from PIL import Image, ImageDraw
            import io

            session = new_session('u2net')
            with open(input_path, 'rb') as i:
                subject_bytes = remove(i.read(), session=session)

            subject = Image.open(io.BytesIO(subject_bytes)).convert("RGBA")

            size = max(subject.width, subject.height)
            size = int(size * 1.2) # padding

            background = Image.new("RGBA", (size, size), (0,0,0,0))
            draw = ImageDraw.Draw(background)

            color = bg_color if bg_color.startswith("#") else f"#{bg_color}"
            draw.ellipse((0, 0, size, size), fill=color)

            offset_x = (size - subject.width) // 2
            offset_y = (size - subject.height) // 2

            background.paste(subject, (offset_x, offset_y), subject)
            background.save(output_path, "PNG")
            return True
        except ImportError:
            raise Exception("Required libraries (rembg/Pillow) are not installed on the server")
        except Exception as e:
            raise Exception(f"Profile picture creation failed: {e}")

    @staticmethod
    def generate_qr_code(url: str, output_path: str) -> bool:
        """
        Generates a QR code from a URL.
        """
        try:
            import qrcode
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=4,
            )
            qr.add_data(url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            img.save(output_path)
            return True
        except ImportError:
            raise Exception("qrcode library is not installed on the server")
        except Exception as e:
            raise Exception(f"QR code generation failed: {e}")
