from services.vector_store import FAISSVectorStore
import os

# Singleton instance
_vector_store_instance = None

def get_vector_store() -> FAISSVectorStore:
    """
    Get or create the singleton FAISSVectorStore instance.
    This ensures that both upload and chat routes share the same in-memory index,
    allowing for immediate availability of uploaded documents (hot-reload).
    """
    global _vector_store_instance
    
    if _vector_store_instance is None:
        print("🔄 Initializing Singleton Vector Store...")
        _vector_store_instance = FAISSVectorStore()
        print("✓ Vector Store initialized")
        
    return _vector_store_instance
