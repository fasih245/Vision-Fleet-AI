from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from groq import Groq
from services.dependencies import get_vector_store

router = APIRouter()

# Global clients
groq_client = None

def get_services():
    """Initialize services lazily"""
    global groq_client
    
    # Get singleton vector store
    vector_store = get_vector_store()
    
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
        # print("✓ Supabase client initialized") # Reduce noise
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

async def generate_title_background(conversation_id: str, first_message: str):
    """Generate and update conversation title in background"""
    try:
        print(f"🤖 Generating title for conversation {conversation_id}...")
        _, client = get_services()
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": "Summarize the user's message into a short, concise title (max 5 words). Return ONLY the title, no quotes or extra text."
                },
                {
                    "role": "user", 
                    "content": first_message
                }
            ],
            max_tokens=20,
            temperature=0.5
        )
        
        title = completion.choices[0].message.content.strip().strip('"')
        print(f"✓ Generated title: {title}")
        
        supabase = get_supabase_client()
        if supabase:
            supabase.table('conversations').update({
                'title': title
            }).eq('id', conversation_id).execute()
            print(f"✓ Updated conversation title in DB")
            
    except Exception as e:
        print(f"⚠️  Failed to auto-generate title: {e}")

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
    background_tasks: BackgroundTasks,
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
                k=20,
                user_id=user_id
            )
            
            if not search_results:
                print("⚠️  No relevant documents found")
                answer = "I couldn't find any relevant information in your documents. Please make sure you've uploaded documents or try rephrasing your question."
                sources = []
            else:
                print(f"✓ Found {len(search_results)} total chunks")
                
                # FILTER BY RELEVANCE
                relevant_results = [
                    (doc, score) for doc, score in search_results
                    if score < 1.8
                ]
                
                print(f"✓ Filtered to {len(relevant_results)} relevant chunks (distance < 1.8)")
                
                if len(relevant_results) == 0:
                    print("⚠️  No highly relevant chunks found after filtering")
                    answer = "I found some documents, but none seem directly relevant to your question. Could you rephrase or ask about something else?"
                    sources = []
                else:
                    # Use top 4-6 most relevant chunks
                    final_results = relevant_results[:6]
                    
                    # Build context
                    context = "\n\n".join([
                        f"[Document: {doc.metadata.get('source', 'Unknown')}]\n{doc.page_content}"
                        for doc, score in final_results
                    ])
                    
                    # Create prompt
                    prompt = f"""You are a helpful AI assistant analyzing documents. Use the following context to answer the user's question accurately and specifically.

Context from documents:
{context}

User question: {request.question}

Instructions:
- Answer based ONLY on the information in the context above
- Be specific and cite which document(s) you're referencing
- If the context doesn't contain enough information, say so clearly
- Don't make up information not present in the context

Answer:"""
                    
                    # Generate response
                    print("🤖 Generating response with context...")
                    completion = groq_client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a helpful assistant that answers questions based on provided documents. Always cite which document you're referencing and be specific."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        temperature=0.3,
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
                        for doc, score in final_results
                    ]
        
        else:
            print("💬 Using LLM-only mode...")
            
            # Direct LLM conversation
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

        # Save to Supabase
        if request.conversation_id:
            supabase = get_supabase_client()
            if supabase:
                try:
                    # Check if this is the first message (or title is default)
                    conv_data = supabase.table('conversations').select('title').eq('id', request.conversation_id).single().execute()
                    current_title = conv_data.data.get('title') if conv_data.data else None
                    
                    # Save message
                    message_data = {
                        'conversation_id': request.conversation_id,
                        'user_message': request.question,
                        'assistant_response': answer,
                        'sources': sources if sources else None,
                        'model_used': "llama-3.3-70b-versatile",
                    }
                    
                    supabase.table('messages').insert(message_data).execute()
                    print(f"✓ Saved message to conversation {request.conversation_id}")
                    
                    # Update timestamp
                    supabase.table('conversations').update({
                        'updated_at': 'now()'
                    }).eq('id', request.conversation_id).execute()
                    
                    # Trigger auto-naming if title is default
                    if current_title in ['New Chat', 'New Conversation']:
                        background_tasks.add_task(
                            generate_title_background, 
                            request.conversation_id, 
                            request.question
                        )
                    
                except Exception as db_error:
                    print(f"⚠️  Failed to save to database: {db_error}")
        else:
            print("⚠️  No conversation_id provided, message not saved to history")

        return ChatResponse(
            answer=answer,
            sources=sources,
            conversation_id=request.conversation_id
        )

    except ValueError as ve:
        print(f"❌ Configuration error: {ve}")
        raise HTTPException(status_code=500, detail=f"Configuration error: {str(ve)}")
    
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all messages from a conversation"""
    try:
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            user_id = "anonymous"
        
        supabase = get_supabase_client()
        if not supabase:
            return {"messages": [], "count": 0, "conversation_id": conversation_id}
        
        # Verify ownership
        conv_result = supabase.table('conversations').select('user_id, title').eq('id', conversation_id).single().execute()
        
        if not conv_result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if conv_result.data['user_id'] != user_id and user_id != "anonymous":
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Get messages
        messages_result = supabase.table('messages').select('*').eq('conversation_id', conversation_id).order('created_at', desc=False).execute()
        messages = messages_result.data if messages_result.data else []
        
        return {
            "messages": messages,
            "count": len(messages),
            "conversation_id": conversation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error loading messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load messages: {str(e)}")

@router.get("/conversations")
async def get_user_conversations(authorization: Optional[str] = Header(None)):
    """Get all conversations for the authenticated user"""
    try:
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            user_id = "anonymous"
        
        supabase = get_supabase_client()
        if not supabase:
            return {"conversations": [], "count": 0}
        
        conv_result = supabase.table('conversations').select('*').eq('user_id', user_id).order('updated_at', desc=True).execute()
        conversations = conv_result.data if conv_result.data else []
        
        return {"conversations": conversations, "count": len(conversations)}
        
    except Exception as e:
        print(f"❌ Error loading conversations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load conversations: {str(e)}")

@router.post("/conversations")
async def create_conversation(
    title: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Create a new conversation"""
    try:
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            user_id = "anonymous"
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        conv_result = supabase.table('conversations').insert({
            'user_id': user_id,
            'title': title or 'New Chat'
        }).execute()
        
        if not conv_result.data:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        
        return {"conversation": conv_result.data[0], "message": "Conversation created successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {str(e)}")

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a conversation"""
    try:
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Verify ownership
        conv_result = supabase.table('conversations').select('user_id').eq('id', conversation_id).single().execute()
        if not conv_result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if conv_result.data['user_id'] != user_id and user_id != "anonymous":
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        supabase.table('conversations').delete().eq('id', conversation_id).execute()
        
        return {"message": "Conversation deleted successfully", "conversation_id": conversation_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {str(e)}")

@router.options("/chat")
async def chat_options():
    return {"status": "ok"}