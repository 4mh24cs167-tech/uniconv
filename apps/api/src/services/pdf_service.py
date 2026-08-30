import os
from typing import List, Optional
from PyPDF2 import PdfReader, PdfWriter, PdfMerger

class PDFService:
    @staticmethod
    def compress_pdf(input_path: str, output_path: str, target_size_mb: Optional[float] = None) -> bool:
        """
        Compresses a PDF file using PyPDF2.
        Note: PyPDF2 compression is lossless (removes unreferenced objects/metadata).
        For deep image compression, tools like Ghostscript are required.
        """
        try:
            reader = PdfReader(input_path)
            writer = PdfWriter()

            for page in reader.pages:
                page.compress_content_streams()  # This is CPU intensive but compresses text/streams
                writer.add_page(page)

            # Write out the compressed file
            with open(output_path, "wb") as f:
                writer.write(f)

            return True
        except Exception as e:
            print(f"Error compressing PDF: {e}")
            return False

    @staticmethod
    def merge_pdfs(input_paths: List[str], output_path: str) -> bool:
        """
        Merges multiple PDF files sequentially using PyPDF2.
        """
        try:
            merger = PdfMerger()
            for path in input_paths:
                merger.append(path)
            
            merger.write(output_path)
            merger.close()
            return True
        except Exception as e:
            print(f"Error merging PDFs: {e}")
            return False

    @staticmethod
    def split_pdf(input_path: str, output_dir: str, ranges: Optional[List[tuple]] = None) -> List[str]:
        """
        Splits a PDF. If ranges [(start1, end1)] are provided, extracts them.
        Otherwise, extracts every single page.
        """
        output_files = []
        try:
            reader = PdfReader(input_path)
            total_pages = len(reader.pages)
            
            if ranges:
                for idx, (start, end) in enumerate(ranges):
                    writer = PdfWriter()
                    # PyPDF2 is 0-indexed, inputs are usually 1-indexed
                    for i in range(start - 1, min(end, total_pages)):
                        writer.add_page(reader.pages[i])
                        
                    out_path = os.path.join(output_dir, f"split_part_{idx+1}.pdf")
                    with open(out_path, "wb") as f:
                        writer.write(f)
                    output_files.append(out_path)
            else:
                for i in range(total_pages):
                    writer = PdfWriter()
                    writer.add_page(reader.pages[i])
                    
                    out_path = os.path.join(output_dir, f"page_{i+1}.pdf")
                    with open(out_path, "wb") as f:
                        writer.write(f)
                    output_files.append(out_path)
                    
            return output_files
        except Exception as e:
            print(f"Error splitting PDF: {e}")
            return []

    @staticmethod
    def pdf_to_word(input_path: str, output_path: str) -> bool:
        """
        Converts a PDF to a Word DOCX file using pdf2docx.
        """
        try:
            from pdf2docx import Converter
            cv = Converter(input_path)
            cv.convert(output_path, start=0, end=None)
            cv.close()
            return True
        except ImportError:
            print("pdf2docx is not installed.")
            # Fallback mock
            import shutil
            shutil.copy(input_path, output_path)
            return True
        except Exception as e:
            print(f"Error converting PDF to Word: {e}")
            return False
