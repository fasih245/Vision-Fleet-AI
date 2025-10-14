from groq import Groq
import os
from typing import List

class RAGService:
    def __init__(self, vector_store):
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.vector_store = vector_store
    
    def generate_response(self, query: str) -> dict:
        """Generate response using RAG"""
        
        # Search for relevant documents
        search_results = self.vector_store.search(query, k=4)
        
        if not search_results:
            return {
                "answer": "No relevant documents found. Please upload documents first.",
                "sources": []
            }
        
        # Extract context from search results
        context_pieces = []
        sources = []
        
        for doc, distance in search_results:
            context_pieces.append(doc.page_content)
            sources.append({
                "source": doc.metadata.get("source", "Unknown"),
                "chunk_index": doc.metadata.get("chunk_index", 0),
                "relevance_score": 1 / (1 + distance)  # Convert distance to similarity
            })
        
        context = "\n\n".join(context_pieces)
        
        # Create prompt
        prompt = f"""You are a helpful assistant. Answer the question based on the provided context.
        
Context:
{context}

Question: {query}

Provide a comprehensive answer based on the context. If the context doesn't contain enough information, say so."""

        # Generate response with Groq
        try:
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions based on provided context."},
                    {"role": "user", "content": prompt}
                ],
                model="mixtral-8x7b-32768",
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