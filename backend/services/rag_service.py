from groq import Groq
import os
from typing import List

class RAGService:
    def __init__(self, vector_store):
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.vector_store = vector_store
    
    def generate_response(self, query: str, user_id: str = None) -> dict:
        """Generate response using RAG"""
        
        # Search for relevant documents
        search_results = self.vector_store.search(query, k=4)
        
        if not search_results:
            return {
                "answer": "No relevant documents found. Please upload documents first.",
                "sources": []
            }
        
        # Filter results by user_id if provided
        if user_id:
            # Get user's document IDs from metadata
            filtered_results = []
            for doc, distance in search_results:
                # Check if document belongs to this user
                doc_source = doc.metadata.get("source", "")
                # You'll need to store user_id in metadata when uploading
                doc_user_id = doc.metadata.get("user_id", None)
                if doc_user_id == user_id or doc_user_id is None:  # Allow null for backward compatibility
                    filtered_results.append((doc, distance))
            
            search_results = filtered_results
        
        if not search_results:
            return {
                "answer": "No relevant documents found in your library. Please upload documents first.",
                "sources": []
            }
        
        # Rest of the code remains the same...
        context_pieces = []
        sources = []
        
        for doc, distance in search_results:
            context_pieces.append(doc.page_content)
            sources.append({
                "source": doc.metadata.get("source", "Unknown"),
                "chunk_index": doc.metadata.get("chunk_index", 0),
                "relevance_score": 1 / (1 + distance)
            })
        
        context = "\n\n".join(context_pieces)
        
        prompt = f"""You are a helpful assistant. Answer the question based on the provided context.
        
Context:
{context}

Question: {query}

Provide a comprehensive answer based on the context. If the context doesn't contain enough information, say so."""

        try:
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions based on provided context."},
                    {"role": "user", "content": prompt}
                ],
                model=os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.2,
                max_tokens=1024,
            )
            
            answer = chat_completion.choices[0].message.content
            
            return {
                "answer": answer,
                "sources": sources
            }
        
        except Exception as e:
            return {
                "answer": f"Error generating response: {str(e)}",
                "sources": sources
            }