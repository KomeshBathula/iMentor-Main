import os
from typing import Optional
from xhtml2pdf import pisa

from config import settings
from utils.logger import logger


class PDFExporter:
    """
    PDF Generator converting HTML research reports into styled PDF documents.
    """

    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.join(settings.UPLOAD_DIR, "reports")
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_pdf(self, html_content: str, filename: str) -> Optional[str]:
        """
        Convert HTML content to PDF file on disk.
        """
        filepath = os.path.join(self.output_dir, filename if filename.endswith(".pdf") else f"{filename}.pdf")

        styled_html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.5; padding: 20px; }}
                h1 {{ color: #1e293b; font-size: 20pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }}
                h2 {{ color: #0f172a; font-size: 15pt; margin-top: 20px; }}
                h3 {{ color: #334155; font-size: 13pt; }}
                code {{ background-color: #f1f5f9; font-family: monospace; font-size: 9pt; padding: 2px 4px; }}
                pre {{ background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-size: 9pt; }}
                table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                th, td {{ border: 1px solid #cbd5e1; padding: 8px; text-align: left; }}
                th {{ background-color: #f1f5f9; }}
                a {{ color: #2563eb; text-decoration: none; }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """

        try:
            with open(filepath, "wb") as pdf_file:
                pisa_status = pisa.CreatePDF(styled_html, dest=pdf_file)

            if pisa_status.err:
                logger.error(f"[PDFExporter] Error rendering PDF: {pisa_status.err}")
                return None

            logger.info(f"[PDFExporter] PDF successfully generated at {filepath}")
            return filepath
        except Exception as exc:
            logger.error(f"[PDFExporter] Failed to generate PDF: {exc}")
            return None
