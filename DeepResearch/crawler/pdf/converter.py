import fitz
import os
from typing import List

class PDFConverter:
    @staticmethod
    def pdf_to_images(pdf_path: str, output_dir: str, dpi: int = 150) -> List[str]:
        os.makedirs(output_dir, exist_ok=True)
        img_paths: List[str] = []
        
        doc = fitz.open(pdf_path)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        for idx, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi)
            out_path = os.path.join(output_dir, f"{base_name}_page_{idx + 1}.png")
            pix.save(out_path)
            img_paths.append(out_path)
            
        doc.close()
        return img_paths
