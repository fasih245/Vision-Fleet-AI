from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import json
from groq import Groq
from services.dependencies import get_vector_store

router = APIRouter()

# Global clients
groq_client = None

# Single source of truth for the chat model name — was previously hardcoded
# in 3 separate places, which is how a Groq model deprecation turned into a
# 3-file grep-and-replace. Override via LLM_MODEL in backend/.env.
CHAT_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

# Conversation-memory tuning. Token counts are approximate (no local
# tokenizer for Groq-hosted models), using a ~4-chars-per-token heuristic.
CHARS_PER_TOKEN = 4
MAX_HISTORY_TOKENS = 1200
MAX_HISTORY_MESSAGES_FETCH = 20
HISTORY_SHRINK_THRESHOLD_TOKENS = 600

# Pinecone returns cosine similarity — HIGHER means more relevant (opposite
# direction from the old FAISS L2 distance, where lower meant closer).
# Starting value, not empirically tuned yet — watch real query results and
# adjust: too many irrelevant chunks getting through -> raise it; genuinely
# relevant chunks getting filtered out -> lower it.
RELEVANCE_SCORE_THRESHOLD = 0.3

def get_services(user_id: str):
    """Initialize services lazily
    
    Args:
        user_id: User ID for scoped vector store access
    """
    global groq_client
    
    # Get user-scoped vector store
    vector_store = get_vector_store(user_id)
    
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

def estimate_tokens(text: str) -> int:
    """Rough token count for budgeting — chars/4, since Groq doesn't expose a client-side tokenizer."""
    return max(1, len(text or "") // CHARS_PER_TOKEN)

def get_conversation_history(supabase, conversation_id: Optional[str], max_tokens: int = MAX_HISTORY_TOKENS) -> List[Dict[str, str]]:
    """Fetch recent turns for a conversation as chat-formatted messages, newest-first,
    keeping as many as fit under max_tokens. Always keeps at least the most recent
    turn even if it alone exceeds the budget.
    """
    if not supabase or not conversation_id:
        return []

    try:
        result = supabase.table('messages') \
            .select('user_message, bot_response') \
            .eq('conversation_id', conversation_id) \
            .order('created_at', desc=True) \
            .limit(MAX_HISTORY_MESSAGES_FETCH) \
            .execute()
        rows = result.data if result.data else []
    except Exception as e:
        print(f"⚠️  Failed to fetch conversation history: {e}")
        return []

    history: List[Dict[str, str]] = []
    used_tokens = 0

    for row in rows:  # newest first
        user_text = row.get('user_message') or ''
        bot_text = row.get('bot_response') or ''
        pair_tokens = estimate_tokens(user_text) + estimate_tokens(bot_text)

        if history and used_tokens + pair_tokens > max_tokens:
            break

        history[0:0] = [
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": bot_text},
        ]
        used_tokens += pair_tokens

    if history:
        print(f"🧠 Loaded {len(history) // 2} prior turn(s) into context window (~{used_tokens} tokens)")

    return history

async def generate_title_background(conversation_id: str, first_message: str, user_id: str):
    """Generate and update conversation title in background"""
    try:
        print(f"🤖 Generating title for conversation {conversation_id}...")
        _, client = get_services(user_id)
        
        completion = client.chat.completions.create(
            model=CHAT_MODEL,
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
        import traceback
        traceback.print_exc()

class ChatRequest(BaseModel):
    question: str
    use_rag: bool = True
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = []
    conversation_id: Optional[str] = None

def _sse(payload: dict) -> str:
    """Format one Server-Sent-Events frame."""
    return f"data: {json.dumps(payload)}\n\n"

@router.post("/chat")
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """
    Chat endpoint with RAG support, streamed to the client token-by-token
    over Server-Sent Events instead of one blocking JSON response.
    - If use_rag=True: Search documents and use context
    - If use_rag=False: Direct LLM conversation
    """
    print(f"\n📨 Received chat request: {request.question[:50]}...")
    print(f"🔧 RAG enabled: {request.use_rag}")

    # Everything through prompt construction happens BEFORE the stream
    # starts, so it can still raise normal HTTPExceptions — once the
    # StreamingResponse begins, headers are already committed and errors
    # have to be sent as an SSE event instead (see event_stream() below).

    # Get user ID
    user_id = get_user_id_from_token(authorization)

    if not user_id:
        user_id = "anonymous"
        print("⚠️  No user authentication")
    else:
        print(f"👤 User ID: {user_id}")

    # Verify conversation ownership before touching it, and load prior
    # turns for context.
    supabase = get_supabase_client()
    history: List[Dict[str, str]] = []

    if request.conversation_id:
        if supabase:
            conv_owner = supabase.table('conversations').select('user_id').eq('id', request.conversation_id).single().execute()
            if not conv_owner.data:
                raise HTTPException(status_code=404, detail="Conversation not found")
            if conv_owner.data['user_id'] != user_id:
                raise HTTPException(status_code=403, detail="Unauthorized")

        history = get_conversation_history(supabase, request.conversation_id)

    history_tokens = sum(estimate_tokens(m["content"]) for m in history)

    try:
        vector_store, groq_client = get_services(user_id)
    except ValueError as ve:
        print(f"❌ Configuration error: {ve}")
        raise HTTPException(status_code=500, detail="Server configuration error")

    # Precompute the canned-response cases and the RAG/LLM prompt so the
    # generator below only has to worry about streaming + saving.
    canned_answer: Optional[str] = None
    llm_messages: List[Dict[str, str]] = []
    sources: List[dict] = []
    temperature = 0.3

    if request.use_rag:
        print("🔍 Using RAG mode...")

        # Search for relevant documents (user_id parameter deprecated - scoping at index level)
        search_results = vector_store.search(request.question, k=20)

        if not search_results:
            print("⚠️  No relevant documents found")
            canned_answer = "I couldn't find any relevant information in your documents. Please make sure you've uploaded documents or try rephrasing your question."
        else:
            print(f"✓ Found {len(search_results)} total chunks")

            # FILTER BY RELEVANCE (cosine similarity — higher is better)
            relevant_results = [
                (doc, score) for doc, score in search_results
                if score > RELEVANCE_SCORE_THRESHOLD
            ]

            print(f"✓ Filtered to {len(relevant_results)} relevant chunks (similarity > {RELEVANCE_SCORE_THRESHOLD})")

            if len(relevant_results) == 0:
                print("⚠️  No highly relevant chunks found after filtering")
                canned_answer = "I found some documents, but none seem directly relevant to your question. Could you rephrase or ask about something else?"
            else:
                # Use fewer chunks when conversation history is already
                # eating into the token budget, so total request size
                # stays roughly stable rather than growing unbounded.
                top_k = 4 if history_tokens > HISTORY_SHRINK_THRESHOLD_TOKENS else 6
                final_results = relevant_results[:top_k]

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

                llm_messages = [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that answers questions based on provided documents. Always cite which document you're referencing and be specific."
                    },
                    *history,
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]

                sources = [
                    {
                        "source": doc.metadata.get("source", "Unknown"),
                        "chunk_index": doc.metadata.get("chunk_index", 0),
                        "relevance_score": float(score)
                    }
                    for doc, score in final_results
                ]

    else:
        print(f"💬 Using LLM-only mode (+{len(history)} history messages)...")
        temperature = 0.7
        llm_messages = [
            {
                "role": "system",
                "content": "You are a helpful AI assistant. Answer questions clearly and concisely."
            },
            *history,
            {
                "role": "user",
                "content": request.question
            }
        ]

    print(f"🤖 Streaming response (+{len(history)} history messages)...")

    async def event_stream():
        full_answer = ""

        try:
            if canned_answer is not None:
                full_answer = canned_answer
                yield _sse({"type": "chunk", "content": canned_answer})
            else:
                stream = groq_client.chat.completions.create(
                    model=CHAT_MODEL,
                    messages=llm_messages,
                    temperature=temperature,
                    max_tokens=1024,
                    stream=True,
                )

                for part in stream:
                    u = getattr(part, "usage", None)
                    if u:
                        # This SDK returns usage as a plain dict on stream
                        # chunks, unlike the attribute-style object it uses
                        # for non-streaming responses — handle both shapes.
                        get = u.get if isinstance(u, dict) else lambda k: getattr(u, k, None)
                        print(f"🔢 Token usage — prompt: {get('prompt_tokens')}, completion: {get('completion_tokens')}, total: {get('total_tokens')}")

                    if not part.choices:
                        continue

                    delta_content = getattr(part.choices[0].delta, "content", None)
                    if delta_content:
                        full_answer += delta_content
                        yield _sse({"type": "chunk", "content": delta_content})

            yield _sse({
                "type": "done",
                "sources": sources,
                "conversation_id": request.conversation_id,
            })

            # Save to Supabase now that the full answer is known (reusing
            # the client fetched earlier in this request)
            if request.conversation_id and supabase:
                try:
                    # Check if this is the first message (or title is default)
                    conv_data = supabase.table('conversations').select('title').eq('id', request.conversation_id).single().execute()
                    current_title = conv_data.data.get('title') if conv_data.data else None

                    # Save message
                    supabase.table('messages').insert({
                        'conversation_id': request.conversation_id,
                        'user_message': request.question,
                        'bot_response': full_answer,
                        'retrieved_chunks': sources if sources else None
                    }).execute()

                    # Update timestamp
                    supabase.table('conversations').update({
                        'updated_at': 'now()'
                    }).eq('id', request.conversation_id).execute()

                    # Trigger auto-naming if title is default
                    if current_title in ['New Chat', 'New Conversation']:
                        background_tasks.add_task(
                            generate_title_background,
                            request.conversation_id,
                            request.question,
                            user_id
                        )

                except Exception as db_error:
                    print(f"⚠️  Failed to save to database: {db_error}")

        except Exception as e:
            print(f"❌ Chat streaming error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            yield _sse({"type": "error", "message": "Chat request failed"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        background=background_tasks,
    )

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
        
        if conv_result.data['user_id'] != user_id:
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
        raise HTTPException(status_code=500, detail="Failed to load messages")

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
        raise HTTPException(status_code=500, detail="Failed to load conversations")

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
        raise HTTPException(status_code=500, detail="Failed to create conversation")

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
        
        if conv_result.data['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        supabase.table('conversations').delete().eq('id', conversation_id).execute()
        
        return {"message": "Conversation deleted successfully", "conversation_id": conversation_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete conversation")

@router.options("/chat")
async def chat_options():
    return {"status": "ok"}