import fitz
import os
from typing import List

class PDFSplitter:
    @staticmethod
    def split_pdf(pdf_path: str, output_dir: str) -> List[str]:
        os.makedirs(output_dir, exist_ok=True)
        split_paths: List[str] = []
        
        doc = fitz.open(pdf_path)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        for idx in range(doc.page_count):
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
            out_path = os.path.join(output_dir, f"{base_name}_page_{idx + 1}.pdf")
            new_doc.save(out_path)
            new_doc.close()
            split_paths.append(out_path)
            
        doc.close()
        return split_paths
