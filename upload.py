from fastapi import APIRouter, UploadFile, File, HTTPException
from services.document_processor import DocumentProcessor
from services.vector_store import FAISSVectorStore
import os
import shutil

router = APIRouter()
processor = DocumentProcessor()
vector_store = FAISSVectorStore()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process document
        documents = processor.process_file(file_path, file.filename)
        
        # Add to vector store
        num_added = vector_store.add_documents(documents)
        
        # Clean up
        os.remove(file_path)
        
        return {
            "message": f"Successfully processed {file.filename}",
            "chunks_created": num_added
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))