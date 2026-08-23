from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from typing import Optional, List
import os
import shutil
import uuid
import traceback
from services.document_processor import DocumentProcessor
from services.dependencies import get_vector_store

router = APIRouter()

# Global services
processor = None

def get_services(user_id: str):
    """Initialize document processing services
    
    Args:
        user_id: User ID for scoped vector store access
    """
    global processor
    
    # Get user-scoped vector store
    vector_store = get_vector_store(user_id)
    
    if processor is None:
        try:
            processor = DocumentProcessor()
            print("✓ Document processing services initialized")
        except Exception as e:
            print(f"❌ Failed to initialize services: {e}")
            raise
    return processor, vector_store

def get_supabase_client():
    """Get Supabase client"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️  Supabase credentials not found in environment")
            return None
        
        from supabase import create_client, Client
        client: Client = create_client(supabase_url, supabase_key)
        return client
        
    except ImportError:
        print("⚠️  Supabase library not installed")
        return None
    except Exception as e:
        print(f"⚠️  Supabase initialization error: {type(e).__name__}: {e}")
        return None

def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract and verify user ID from authorization token.

    Returns the real user id on success, or None if no token was supplied
    or the token failed verification. Callers must NOT treat None as a
    valid identity — a token that fails verification must never resolve
    to any value that an ownership check treats as privileged.
    """
    if not authorization:
        return None

    try:
        token = authorization.replace("Bearer ", "").strip()

        if not token:
            return None

        supabase = get_supabase_client()
        if not supabase:
            print("⚠️  Cannot verify token: Supabase client unavailable")
            return None

        user_response = supabase.auth.get_user(token)
        if user_response and hasattr(user_response, 'user') and user_response.user:
            return user_response.user.id

        return None

    except Exception as e:
        print(f"⚠️  Token validation error: {e}")
        return None

def cleanup_temp_file(file_path: str):
    """Safely remove temporary file"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"✓ Cleaned up temporary file: {file_path}")
    except Exception as e:
        print(f"⚠️  Failed to delete temporary file: {e}")

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """
    Upload and process a document
    """
    file_path = None
    
    try:
        print("\n" + "="*60)
        print("📤 UPLOAD REQUEST RECEIVED")
        print("="*60)
        
        # Get user ID first
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            user_id = "anonymous"
            print("⚠️  Proceeding with anonymous upload")
        
        print(f"👤 User ID: {user_id}")
        print(f"📄 File: {file.filename}")
        
        # Initialize services with user_id
        processor, vector_store = get_services(user_id)
        
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.txt', '.csv']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{file_extension}'. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Create upload directory
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Create unique filename
        unique_filename = f"{user_id}_{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save uploaded file
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            print(f"❌ Failed to save uploaded file: {e}")
            raise HTTPException(status_code=500, detail="Failed to save uploaded file")
        
        file_size = os.path.getsize(file_path)
        
        # Validate file size (50 MB)
        max_size = 50 * 1024 * 1024
        if file_size > max_size:
            cleanup_temp_file(file_path)
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
        document_id = None
        supabase = get_supabase_client()
        
        # Save metadata
        if supabase:
            try:
                doc_result = supabase.table('documents').insert({
                    'user_id': user_id,
                    'title': file.filename,
                    'content': '',
                    'source_type': 'file',
                    'source_path': file.filename,
                    'file_size': file_size,
                    'file_type': file.content_type or 'application/octet-stream',
                    'is_processed': False,
                    'chunk_count': 0
                }).execute()
                
                if doc_result.data:
                    document_id = doc_result.data[0]['id']
            except Exception as e:
                print(f"⚠️  Failed to save metadata: {e}")
        
        # Process document
        print("\n🔄 Processing document...")
        try:
            documents = processor.process_file(file_path, file.filename)
        except Exception as e:
            cleanup_temp_file(file_path)
            print(f"❌ Processing failed: {e}")
            raise HTTPException(status_code=400, detail="Failed to process document")
        
        if not documents:
            cleanup_temp_file(file_path)
            raise HTTPException(status_code=400, detail="No text extracted from document")
        
        # Tag chunks with user_id
        for i, doc in enumerate(documents):
            doc.metadata["user_id"] = user_id
            doc.metadata["document_id"] = document_id if document_id else "unknown"
            doc.metadata["source"] = file.filename
            doc.metadata["chunk_index"] = i
            doc.metadata["total_chunks"] = len(documents)
        
        # Add to vector store (user-scoped)
        print("\n🔄 Adding to vector store...")
        try:
            num_added = vector_store.add_documents(documents)
        except Exception as e:
            cleanup_temp_file(file_path)
            # Rollback Supabase
            if supabase and document_id:
                try:
                    supabase.table('documents').delete().eq('id', document_id).execute()
                except:
                    pass
            print(f"❌ Vector store error: {e}")
            raise HTTPException(status_code=500, detail="Failed to index document")
        
        # Update status
        if supabase and document_id:
            try:
                supabase.table('documents').update({
                    'chunk_count': num_added,
                    'is_processed': True
                }).eq('id', document_id).execute()
            except:
                pass
        
        cleanup_temp_file(file_path)
        
        return {
            "message": f"Successfully processed {file.filename}",
            "filename": file.filename,
            "chunks_created": num_added,
            "document_id": document_id,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if file_path:
            cleanup_temp_file(file_path)
        print(f"❌ Upload failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Upload failed")

@router.get("/documents/{user_id}")
async def get_user_documents(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all documents for a specific user"""
    try:
        requesting_user_id = get_user_id_from_token(authorization)
        if not requesting_user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        if requesting_user_id != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        result = supabase.table('documents').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        documents = result.data if result.data else []
        
        return {"documents": documents, "count": len(documents), "user_id": user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a document"""
    try:
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        doc = supabase.table('documents').select('user_id, title').eq('id', document_id).single().execute()
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if doc.data['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        supabase.table('documents').delete().eq('id', document_id).execute()
        
        return {"message": "Document deleted successfully", "document_id": document_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

@router.options("/upload")
async def upload_options():
    return {"status": "ok"}