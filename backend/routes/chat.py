from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from services.vector_store import FAISSVectorStore
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Initialize services
vector_store = None
groq_client = None

def get_services():
    """Initialize services lazily"""
    global vector_store, groq_client
    
    if vector_store is None:
        vector_store = FAISSVectorStore()
        print("✓ Vector store initialized")
    
    if groq_client is None:
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        groq_client = Groq(api_key=groq_api_key)
        print("✓ Groq client initialized")
    
    return vector_store, groq_client

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
        print("✓ Supabase client initialized")
        return client
        
    except ImportError:
        print("⚠️  Supabase library not installed")
        return None
    except Exception as e:
        print(f"⚠️  Supabase initialization error: {type(e).__name__}: {e}")
        return None

def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract user ID from authorization token"""
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "").strip()
        
        if not token:
            return None
        
        supabase = get_supabase_client()
        if not supabase:
            return "anonymous"
        
        user_response = supabase.auth.get_user(token)
        if user_response and hasattr(user_response, 'user') and user_response.user:
            return user_response.user.id
        
        return "anonymous"
        
    except Exception as e:
        print(f"⚠️  Token validation error: {e}")
        return "anonymous"

class ChatRequest(BaseModel):
    question: str
    use_rag: bool = True
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = []
    conversation_id: Optional[str] = None

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Chat endpoint with RAG support
    - If use_rag=True: Search documents and use context
    - If use_rag=False: Direct LLM conversation
    """
    try:
        print(f"\n📨 Received chat request: {request.question[:50]}...")
        print(f"🔧 RAG enabled: {request.use_rag}")
        
        # Get user ID
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            user_id = "anonymous"
            print("⚠️  No user authentication")
        else:
            print(f"👤 User ID: {user_id}")
        
        # Initialize services
        vector_store, groq_client = get_services()
        
        # Generate response based on mode
        if request.use_rag:
            print("🔍 Using RAG mode...")
            
            # Search for relevant documents
            search_results = vector_store.search(
                request.question,
                k=4,
                user_id=user_id
            )
            
            if not search_results:
                print("⚠️  No relevant documents found")
                answer = "I couldn't find any relevant information in your documents. Please make sure you've uploaded documents or try rephrasing your question."
                sources = []
            else:
                print(f"✓ Found {len(search_results)} relevant chunks")
                
                # Build context from search results
                context = "\n\n".join([
                    f"Document: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
                    for doc, score in search_results
                ])
                
                # Create prompt with context
                prompt = f"""You are a helpful AI assistant analyzing documents. Use the following context to answer the user's question. If the answer is not in the context, say so clearly.

Context from documents:
{context}

User question: {request.question}

Answer based on the context above:"""
                
                # Generate response with Groq
                print("🤖 Generating response with context...")
                completion = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful assistant that answers questions based on provided documents. Always cite which document you're referencing."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=1024,
                )
                
                answer = completion.choices[0].message.content
                
                # Extract sources
                sources = [
                    {
                        "source": doc.metadata.get("source", "Unknown"),
                        "chunk_index": doc.metadata.get("chunk_index", 0),
                        "relevance_score": float(score)
                    }
                    for doc, score in search_results
                ]
                
                print(f"✓ Generated response with {len(sources)} sources")
        
        else:
            print("💬 Using LLM-only mode...")
            
            # Direct LLM conversation without RAG
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful AI assistant. Answer questions clearly and concisely."
                    },
                    {
                        "role": "user",
                        "content": request.question
                    }
                ],
                temperature=0.7,
                max_tokens=1024,
            )
            
            answer = completion.choices[0].message.content
            sources = []
            
            print("✓ Generated direct LLM response")
        
        # Save to Supabase if conversation_id provided
        if request.conversation_id:
            supabase = get_supabase_client()
            if supabase:
                try:
                    print(f"💾 Saving message to conversation: {request.conversation_id}")
                    
                    # Save message
                    message_result = supabase.table('messages').insert({
                        'conversation_id': request.conversation_id,
                        'user_message': request.question,
                        'assistant_response': answer,
                        'sources': sources if sources else None
                    }).execute()
                    
                    if message_result.data:
                        print(f"✓ Message saved to database")
                    
                    # Update conversation timestamp
                    supabase.table('conversations').update({
                        'updated_at': 'now()'
                    }).eq('id', request.conversation_id).execute()
                    
                except Exception as db_error:
                    print(f"⚠️  Failed to save to database: {db_error}")
                    # Don't fail the request if DB save fails
        
        print("✅ Response generated successfully")
        
        return ChatResponse(
            answer=answer,
            sources=sources,
            conversation_id=request.conversation_id
        )
    
    except ValueError as ve:
        print(f"❌ Configuration error: {ve}")
        raise HTTPException(
            status_code=500,
            detail=f"Configuration error: {str(ve)}"
        )
    
    except Exception as e:
        print(f"❌ Chat error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {str(e)}"
        )

@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all messages from a conversation"""
    try:
        print(f"\n📥 Loading messages for conversation: {conversation_id}")
        
        # Get user ID
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            user_id = "anonymous"
            print("⚠️  No authentication - using anonymous")
        
        supabase = get_supabase_client()
        if not supabase:
            print("⚠️  Supabase not available")
            return {
                "messages": [],
                "count": 0,
                "conversation_id": conversation_id
            }
        
        # Verify conversation ownership
        print(f"🔍 Verifying conversation ownership...")
        conv_result = supabase.table('conversations')\
            .select('user_id, title')\
            .eq('id', conversation_id)\
            .single()\
            .execute()
        
        if not conv_result.data:
            print(f"❌ Conversation not found: {conversation_id}")
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )
        
        # Check if user owns this conversation
        if conv_result.data['user_id'] != user_id and user_id != "anonymous":
            print(f"❌ Unauthorized access attempt")
            raise HTTPException(
                status_code=403,
                detail="Unauthorized: You don't own this conversation"
            )
        
        print(f"✓ Conversation verified: {conv_result.data.get('title', 'Untitled')}")
        
        # Get messages
        print(f"📨 Fetching messages...")
        messages_result = supabase.table('messages')\
            .select('*')\
            .eq('conversation_id', conversation_id)\
            .order('created_at', desc=False)\
            .execute()
        
        messages = messages_result.data if messages_result.data else []
        
        print(f"✅ Loaded {len(messages)} messages")
        
        return {
            "messages": messages,
            "count": len(messages),
            "conversation_id": conversation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error loading messages: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load messages: {str(e)}"
        )

@router.get("/conversations")
async def get_user_conversations(
    authorization: Optional[str] = Header(None)
):
    """Get all conversations for the authenticated user"""
    try:
        print(f"\n📋 Loading user conversations...")
        
        # Get user ID
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            user_id = "anonymous"
            print("⚠️  No authentication - using anonymous")
        
        print(f"👤 User ID: {user_id}")
        
        supabase = get_supabase_client()
        if not supabase:
            print("⚠️  Supabase not available")
            return {
                "conversations": [],
                "count": 0
            }
        
        # Get conversations
        conv_result = supabase.table('conversations')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('updated_at', desc=True)\
            .execute()
        
        conversations = conv_result.data if conv_result.data else []
        
        print(f"✅ Loaded {len(conversations)} conversations")
        
        return {
            "conversations": conversations,
            "count": len(conversations)
        }
        
    except Exception as e:
        print(f"❌ Error loading conversations: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load conversations: {str(e)}"
        )

@router.post("/conversations")
async def create_conversation(
    title: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Create a new conversation"""
    try:
        print(f"\n➕ Creating new conversation...")
        
        # Get user ID
        user_id = get_user_id_from_token(authorization)
        
        if not user_id:
            user_id = "anonymous"
            print("⚠️  No authentication - using anonymous")
        
        print(f"👤 User ID: {user_id}")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Create conversation
        conv_result = supabase.table('conversations').insert({
            'user_id': user_id,
            'title': title or 'New Conversation'
        }).execute()
        
        if not conv_result.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create conversation"
            )
        
        conversation = conv_result.data[0]
        
        print(f"✅ Created conversation: {conversation['id']}")
        
        return {
            "conversation": conversation,
            "message": "Conversation created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating conversation: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create conversation: {str(e)}"
        )

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a conversation and all its messages"""
    try:
        print(f"\n🗑️  Deleting conversation: {conversation_id}")
        
        # Get user ID
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
        
        # Verify ownership
        conv_result = supabase.table('conversations')\
            .select('user_id, title')\
            .eq('id', conversation_id)\
            .single()\
            .execute()
        
        if not conv_result.data:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )
        
        if conv_result.data['user_id'] != user_id and user_id != "anonymous":
            raise HTTPException(
                status_code=403,
                detail="Unauthorized: You don't own this conversation"
            )
        
        # Delete conversation (cascades to messages)
        supabase.table('conversations')\
            .delete()\
            .eq('id', conversation_id)\
            .execute()
        
        print(f"✅ Deleted conversation: {conv_result.data.get('title', 'Untitled')}")
        
        return {
            "message": "Conversation deleted successfully",
            "conversation_id": conversation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting conversation: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete conversation: {str(e)}"
        )

@router.options("/chat")
async def chat_options():
    """Handle CORS preflight for chat endpoint"""
    return {"status": "ok"}