from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from services.rag_service import RAGService
from services.vector_store import FAISSVectorStore
from typing import Optional
import os

router = APIRouter()
vector_store = None
rag_service = None

def get_supabase_client():
    """Get Supabase client"""
    try:
        if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
            from supabase import create_client
            return create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_KEY")
            )
    except Exception as e:
        print(f"Supabase error: {e}")
    return None

def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract user ID from authorization header"""
    if not authorization:
        return None
    
    try:
        supabase = get_supabase_client()
        if not supabase:
            return None
            
        token = authorization.replace("Bearer ", "").strip()
        user = supabase.auth.get_user(token)
        
        if user and user.user:
            return user.user.id
        
        return None
    except Exception as e:
        print(f"Error extracting user ID: {e}")
        return None

def get_rag_service():
    """Lazy initialization of RAG service"""
    global vector_store, rag_service
    if rag_service is None:
        vector_store = FAISSVectorStore()
        rag_service = RAGService(vector_store)
    return rag_service

class QueryRequest(BaseModel):
    question: str
    use_rag: bool = True

# Add explicit OPTIONS handler for CORS preflight
@router.options("/chat")
async def chat_options():
    """Handle CORS preflight for chat endpoint"""
    return {"status": "ok"}

@router.post("/chat")
async def chat(
    request: QueryRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Chat endpoint with RAG support
    """
    try:
        print(f"📨 Received chat request: {request.question[:50]}...")
        print(f"🔧 RAG enabled: {request.use_rag}")
        
        # Get user ID (optional - can work without auth for testing)
        user_id = get_user_id_from_token(authorization)
        if user_id:
            print(f"👤 User ID: {user_id}")
        else:
            print("⚠️  No user authentication")
        
        service = get_rag_service()
        
        # Generate response with user filtering
        if request.use_rag:
            print("🔍 Using RAG mode...")
            response = service.generate_response(request.question, user_id=user_id)
        else:
            print("💬 Using LLM-only mode...")
            # Direct LLM without RAG
            from groq import Groq
            
            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": request.question}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                max_tokens=1024,
            )
            
            response = {
                "answer": chat_completion.choices[0].message.content,
                "sources": [],
                "mode": "llm_only"
            }
        
        print(f"✅ Response generated successfully")
        return response
        
    except Exception as e:
        print(f"❌ Chat error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/test")
async def test_chat():
    """Simple test endpoint"""
    return {"status": "Chat endpoint is working!", "message": "Hello from chat route"}