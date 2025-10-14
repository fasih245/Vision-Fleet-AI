from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from services.document_processor import DocumentProcessor
from services.vector_store import FAISSVectorStore
import os
import shutil
from dotenv import load_dotenv
from typing import Optional
import uuid

load_dotenv()

router = APIRouter()
processor = None
vector_store = None

def get_supabase_client():
    """Lazy load Supabase client"""
    try:
        if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
            from supabase import create_client
            client = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_KEY")
            )
            print("✓ Supabase client initialized")
            return client
    except Exception as e:
        print(f"⚠️  Supabase initialization error: {e}")
    return None

def get_services():
    """Initialize document processing services"""
    global processor, vector_store
    if processor is None:
        processor = DocumentProcessor()
        vector_store = FAISSVectorStore()
        print("✓ Document processing services initialized")
    return processor, vector_store

def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract user ID from authorization header"""
    if not authorization:
        print("⚠️  No authorization header provided")
        return None
    
    try:
        # Remove 'Bearer ' prefix
        token = authorization.replace("Bearer ", "").strip()
        
        if not token:
            print("⚠️  Empty token after parsing")
            return None
        
        print(f"🔑 Token received: {token[:20]}...")
        
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            print("⚠️  Supabase not available - allowing anonymous upload")
            return "anonymous"
        
        # Verify token with Supabase
        try:
            user_response = supabase.auth.get_user(token)
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_id = user_response.user.id
                print(f"✓ User authenticated: {user_id}")
                return user_id
            else:
                print("⚠️  Invalid token - no user found")
                return "anonymous"
                
        except Exception as auth_error:
            print(f"⚠️  Auth verification failed: {auth_error}")
            return "anonymous"
        
    except Exception as e:
        print(f"❌ Error in token extraction: {e}")
        import traceback
        traceback.print_exc()
        return "anonymous"

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """
    Upload and process a document
    - Extracts text from PDF/DOCX/TXT/CSV
    - Creates embeddings
    - Stores in FAISS vector store
    - Saves metadata to Supabase
    """
    try:
        print("\n" + "="*60)
        print("📤 UPLOAD REQUEST RECEIVED")
        print("="*60)
        
        processor, vector_store = get_services()
        
        # Get user ID from authorization header
        user_id = get_user_id_from_token(authorization)
        
        # Allow anonymous uploads for testing (remove this in production)
        if not user_id:
            user_id = "anonymous"
            print("⚠️  Proceeding with anonymous upload")
        
        print(f"👤 User ID: {user_id}")
        print(f"📄 File: {file.filename}")
        print(f"📊 Content Type: {file.content_type}")
        
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.txt', '.csv']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            print(f"❌ Invalid file type: {file_extension}")
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{file_extension}'. Allowed: {', '.join(allowed_extensions)}"
            )
        
        print(f"✓ File type validated: {file_extension}")
        
        # Create upload directory
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Create unique filename to avoid conflicts
        unique_filename = f"{user_id}_{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        print(f"💾 Saving to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        print(f"✓ File saved: {file_size} bytes")
        
        # Read file content for Supabase storage (optional)
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        document_id = None
        supabase = get_supabase_client()
        
        # Save document metadata to Supabase
        if supabase:
            try:
                print("💾 Saving metadata to Supabase...")
                doc_result = supabase.table('documents').insert({
                    'user_id': user_id,
                    'title': file.filename,
                    'content': '',  # Can store base64 or leave empty
                    'source_type': 'file',
                    'source_path': file.filename,
                    'file_size': file_size,
                    'file_type': file.content_type or 'application/octet-stream',
                    'is_processed': False
                }).execute()
                
                if doc_result.data and len(doc_result.data) > 0:
                    document_id = doc_result.data[0]['id']
                    print(f"✓ Document saved to Supabase: {document_id}")
                else:
                    print("⚠️  Document insert returned no data")
            except Exception as e:
                print(f"⚠️  Failed to save to Supabase: {e}")
                # Continue anyway - FAISS will still work
        else:
            print("⚠️  Supabase not available - skipping metadata storage")
        
        # Process document into chunks
        print("🔄 Processing document into chunks...")
        documents = processor.process_file(file_path, file.filename)
        print(f"✓ Created {len(documents)} chunks")
        
        # CRITICAL: Add user_id to each document's metadata
        for i, doc in enumerate(documents):
            doc.metadata["user_id"] = user_id
            doc.metadata["document_id"] = document_id
            doc.metadata["source"] = file.filename
            doc.metadata["chunk_index"] = i
            if i == 0:  # Log first chunk for verification
                print(f"✓ Tagged chunk {i} with user_id: {user_id}")
        
        print(f"✓ All {len(documents)} chunks tagged with user_id")
        
        # Add to vector store (FAISS + Supabase)
        print("🔄 Adding to vector store...")
        num_added = vector_store.add_documents(documents)
        print(f"✓ Added {num_added} chunks to vector store")
        
        # Update document processing status in Supabase
        if supabase and document_id:
            try:
                supabase.table('documents').update({
                    'chunk_count': num_added,
                    'is_processed': True,
                    'updated_at': 'now()'
                }).eq('id', document_id).execute()
                print(f"✓ Updated document status in Supabase")
            except Exception as e:
                print(f"⚠️  Failed to update document status: {e}")
        
        # Clean up temporary file
        try:
            os.remove(file_path)
            print(f"✓ Cleaned up temporary file")
        except Exception as e:
            print(f"⚠️  Failed to delete temporary file: {e}")
        
        print("="*60)
        print("✅ UPLOAD COMPLETED SUCCESSFULLY")
        print("="*60 + "\n")
        
        return {
            "message": f"Successfully processed {file.filename}",
            "filename": file.filename,
            "chunks_created": num_added,
            "document_id": document_id,
            "user_id": user_id,
            "file_size": file_size,
            "file_type": file_extension,
            "hybrid_mode": vector_store.hybrid_mode if hasattr(vector_store, 'hybrid_mode') else False
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ UPLOAD FAILED: {str(e)}")
        print(f"{'='*60}\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/documents/{user_id}")
async def get_user_documents(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all documents for a specific user"""
    try:
        # Verify the requesting user matches the user_id
        requesting_user_id = get_user_id_from_token(authorization)
        
        if not requesting_user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        if requesting_user_id != user_id and requesting_user_id != "anonymous":
            raise HTTPException(status_code=403, detail="Unauthorized access")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        result = supabase.table('documents')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()
        
        return {
            "documents": result.data,
            "count": len(result.data) if result.data else 0
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a document and its chunks"""
    try:
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Verify document belongs to user
        doc = supabase.table('documents')\
            .select('user_id')\
            .eq('id', document_id)\
            .single()\
            .execute()
        
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if doc.data['user_id'] != user_id and user_id != "anonymous":
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Delete from database (cascades to chunks)
        supabase.table('documents')\
            .delete()\
            .eq('id', document_id)\
            .execute()
        
        print(f"✓ Document {document_id} deleted from database")
        
        # TODO: Remove from FAISS index (requires rebuilding index)
        # For now, documents remain in FAISS but won't match in queries
        # due to user_id filtering in chat endpoint
        
        return {"message": "Document deleted successfully", "document_id": document_id}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.options("/upload")
async def upload_options():
    """Handle CORS preflight for upload endpoint"""
    return {"status": "ok"}