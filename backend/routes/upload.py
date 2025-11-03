from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from services.document_processor import DocumentProcessor
from services.vector_store import FAISSVectorStore
import os
import shutil
from dotenv import load_dotenv
from typing import Optional
import uuid
import traceback

load_dotenv()

router = APIRouter()
processor = None
vector_store = None

def get_supabase_client():
    """Lazy load Supabase client with proper error handling"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️  Supabase credentials not found in environment")
            return None
        
        from supabase import create_client, Client
        client: Client = create_client(supabase_url, supabase_key)
        print("✓ Supabase client initialized successfully")
        return client
        
    except ImportError:
        print("⚠️  Supabase library not installed")
        return None
    except Exception as e:
        print(f"⚠️  Supabase initialization error: {type(e).__name__}: {e}")
        return None

def get_services():
    """Initialize document processing services"""
    global processor, vector_store
    if processor is None:
        try:
            processor = DocumentProcessor()
            vector_store = FAISSVectorStore()
            print("✓ Document processing services initialized")
        except Exception as e:
            print(f"❌ Failed to initialize services: {e}")
            raise
    return processor, vector_store

def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract and verify user ID from authorization header"""
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
            print("⚠️  Supabase not available - cannot verify token")
            return None
        
        # Verify token with Supabase
        try:
            user_response = supabase.auth.get_user(token)
            
            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_id = user_response.user.id
                print(f"✓ User authenticated: {user_id}")
                return user_id
            else:
                print("⚠️  Invalid token - no user found")
                return None
                
        except Exception as auth_error:
            print(f"⚠️  Auth verification failed: {auth_error}")
            return None
        
    except Exception as e:
        print(f"❌ Error in token extraction: {e}")
        traceback.print_exc()
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
    - Validates file type and size
    - Extracts text from PDF/DOCX/TXT/CSV
    - Creates embeddings
    - Stores in FAISS vector store
    - Saves metadata to Supabase
    """
    file_path = None
    
    try:
        print("\n" + "="*60)
        print("📤 UPLOAD REQUEST RECEIVED")
        print("="*60)
        
        # Initialize services
        processor, vector_store = get_services()
        
        # Get user ID from authorization header
        user_id = get_user_id_from_token(authorization)
        
        # For development: allow anonymous uploads
        # TODO: Remove this in production and enforce authentication
        if not user_id:
            user_id = "anonymous"
            print("⚠️  Proceeding with anonymous upload (development mode)")
        
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
                detail=f"Unsupported file type '{file_extension}'. Allowed types: {', '.join(allowed_extensions)}"
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
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            print(f"❌ Failed to save file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
        file_size = os.path.getsize(file_path)
        print(f"✓ File saved: {file_size} bytes")
        
        # Validate file size (optional - adjust limit as needed)
        max_size = 50 * 1024 * 1024  # 50 MB
        if file_size > max_size:
            cleanup_temp_file(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size / (1024*1024):.0f} MB"
            )
        
        document_id = None
        supabase = get_supabase_client()
        
        # Save document metadata to Supabase
        if supabase:
            try:
                print("💾 Saving metadata to Supabase...")
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
                
                if doc_result.data and len(doc_result.data) > 0:
                    document_id = doc_result.data[0]['id']
                    print(f"✓ Document metadata saved to Supabase: {document_id}")
                else:
                    print("⚠️  Document insert returned no data")
                    
            except Exception as e:
                print(f"⚠️  Failed to save metadata to Supabase: {type(e).__name__}: {e}")
                # Continue anyway - FAISS will still work
        else:
            print("⚠️  Supabase not available - skipping metadata storage")
        
        # Process document into chunks
        print("\n🔄 Processing document into chunks...")
        try:
            documents = processor.process_file(file_path, file.filename)
        except ValueError as ve:
            # User-friendly error from document processor
            cleanup_temp_file(file_path)
            print(f"❌ Document processing error: {ve}")
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            cleanup_temp_file(file_path)
            print(f"❌ Unexpected error processing document: {e}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process document: {str(e)}"
            )
        
        # Validate chunks were created
        if not documents or len(documents) == 0:
            cleanup_temp_file(file_path)
            print("❌ No chunks created from document")
            raise HTTPException(
                status_code=400,
                detail="Could not extract meaningful text from document. "
                       "It might be a scanned PDF, image-only, or corrupted file."
            )
        
        print(f"✓ Created {len(documents)} chunks")
        
        # Tag all chunks with metadata
        print("🏷️  Tagging chunks with metadata...")
        for i, doc in enumerate(documents):
            doc.metadata["user_id"] = user_id
            doc.metadata["document_id"] = document_id if document_id else "unknown"
            doc.metadata["source"] = file.filename
            doc.metadata["chunk_index"] = i
            doc.metadata["total_chunks"] = len(documents)
            
            if i == 0:  # Log first chunk for verification
                print(f"✓ Sample chunk metadata: user_id={user_id}, document_id={document_id}")
        
        print(f"✓ All {len(documents)} chunks tagged with user_id: {user_id}")
        
        # Add to vector store (FAISS)
        print("\n🔄 Adding to vector store...")
        try:
            num_added = vector_store.add_documents(documents)
            
            if num_added == 0:
                raise Exception("Vector store reported 0 documents added")
            
            print(f"✓ Successfully added {num_added} chunks to vector store")
            
        except Exception as e:
            cleanup_temp_file(file_path)
            print(f"❌ Failed to add to vector store: {e}")
            traceback.print_exc()
            
            # Try to rollback Supabase entry
            if supabase and document_id:
                try:
                    supabase.table('documents').delete().eq('id', document_id).execute()
                    print(f"✓ Rolled back Supabase entry")
                except:
                    pass
            
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store document embeddings: {str(e)}"
            )
        
        # Update document status in Supabase
        if supabase and document_id:
            try:
                supabase.table('documents').update({
                    'chunk_count': num_added,
                    'is_processed': True
                }).eq('id', document_id).execute()
                print(f"✓ Updated document status in Supabase")
            except Exception as e:
                print(f"⚠️  Failed to update document status: {e}")
        
        # Clean up temporary file
        cleanup_temp_file(file_path)
        
        print("="*60)
        print("✅ UPLOAD COMPLETED SUCCESSFULLY")
        print(f"   Document: {file.filename}")
        print(f"   Chunks: {num_added}")
        print(f"   User: {user_id}")
        print(f"   Document ID: {document_id}")
        print("="*60 + "\n")
        
        return {
            "message": f"Successfully processed {file.filename}",
            "filename": file.filename,
            "chunks_created": num_added,
            "document_id": document_id,
            "user_id": user_id,
            "file_size": file_size,
            "file_type": file_extension,
            "status": "success"
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as e:
        # Catch any unexpected errors
        print(f"\n{'='*60}")
        print(f"❌ UPLOAD FAILED: {type(e).__name__}")
        print(f"   Error: {str(e)}")
        print(f"{'='*60}\n")
        traceback.print_exc()
        
        # Clean up
        if file_path:
            cleanup_temp_file(file_path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )

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
            raise HTTPException(
                status_code=401,
                detail="Authentication required"
            )
        
        # Allow admins or the user themselves
        if requesting_user_id != user_id and requesting_user_id != "anonymous":
            raise HTTPException(
                status_code=403,
                detail="Unauthorized access to user documents"
            )
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        result = supabase.table('documents')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()
        
        documents = result.data if result.data else []
        
        return {
            "documents": documents,
            "count": len(documents),
            "user_id": user_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching documents: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch documents: {str(e)}"
        )

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a document and its chunks from database"""
    try:
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Authentication required"
            )
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Verify document belongs to user
        doc = supabase.table('documents')\
            .select('user_id, title')\
            .eq('id', document_id)\
            .single()\
            .execute()
        
        if not doc.data:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )
        
        # Check ownership
        if doc.data['user_id'] != user_id and user_id != "anonymous":
            raise HTTPException(
                status_code=403,
                detail="Unauthorized: You don't own this document"
            )
        
        # Delete from database (cascades to related data)
        supabase.table('documents')\
            .delete()\
            .eq('id', document_id)\
            .execute()
        
        print(f"✓ Document {document_id} deleted from Supabase")
        
        # NOTE: Document chunks remain in FAISS index
        # They won't appear in searches due to user_id filtering
        # To fully remove: vector store needs rebuild functionality
        
        return {
            "message": "Document deleted successfully",
            "document_id": document_id,
            "title": doc.data['title']
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting document: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )

@router.options("/upload")
async def upload_options():
    """Handle CORS preflight for upload endpoint"""
    return {"status": "ok"}