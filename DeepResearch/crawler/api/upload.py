from fastapi import APIRouter, UploadFile, File
from crawler.models.response import ExtractionResponse
from crawler.services.upload_service import UploadService
from crawler.services.extraction_service import ExtractionService
from crawler.services.indexing_service import IndexingService
from crawler.pdf.parser import PDFParser
from crawler.services.embedding_service import EmbeddingService
from crawler.storage.filesystem import FileSystemStorage
from crawler.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter(prefix="/upload", tags=["Document Upload"])

upload_service = UploadService()
pdf_parser = PDFParser()
extraction_service = ExtractionService(pdf_parser)
embedding_service = EmbeddingService()
filesystem = FileSystemStorage()
indexing_service = IndexingService(embedding_service, filesystem)

@router.post("", response_model=ExtractionResponse)
async def upload_document(file: UploadFile = File(...)) -> ExtractionResponse:
    try:
        content = await file.read()
        local_path = upload_service.save_uploaded_file(file.filename, content)
        doc = await extraction_service.extract_from_file(local_path)
        await indexing_service.index_document(doc)
        return ExtractionResponse(document=doc, success=True)
    except Exception as e:
        logger.error(f"Upload process failed: {e}")
        return ExtractionResponse(
            document=None,
            success=False,
            error=str(e)
        )
