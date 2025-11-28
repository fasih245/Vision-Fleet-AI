from services.vector_store import FAISSVectorStore
from typing import Dict
import os

# Dictionary to store user-scoped vector store instances
# Key: user_id, Value: FAISSVectorStore instance
_vector_store_instances: Dict[str, FAISSVectorStore] = {}

def get_vector_store(user_id: str) -> FAISSVectorStore:
    """
    Get or create a user-scoped FAISSVectorStore instance.
    
    This ensures that each user has their own isolated vector store with separate
    FAISS index files, preventing cross-user document access.
    
    Args:
        user_id: The user ID to scope the vector store to
        
    Returns:
        FAISSVectorStore instance scoped to the specified user
    """
    global _vector_store_instances
    
    if not user_id:
        raise ValueError("user_id is required for vector store access")
    
    # Return existing instance if available
    if user_id in _vector_store_instances:
        return _vector_store_instances[user_id]
    
    # Create new user-scoped instance
    print(f"🔄 Initializing Vector Store for user: {user_id}")
    vector_store = FAISSVectorStore(user_id=user_id)
    _vector_store_instances[user_id] = vector_store
    print(f"✓ Vector Store initialized for user: {user_id}")
    
    return vector_store

def clear_user_vector_store(user_id: str):
    """
    Clear and remove a user's vector store from memory.
    
    Args:
        user_id: The user ID whose vector store should be cleared
    """
    global _vector_store_instances
    
    if user_id in _vector_store_instances:
        _vector_store_instances[user_id].clear_index()
        del _vector_store_instances[user_id]
        print(f"✓ Cleared vector store for user: {user_id}")

def get_all_user_stats() -> Dict[str, dict]:
    """
    Get statistics for all loaded vector stores.
    
    Returns:
        Dictionary mapping user_id to their vector store stats
    """
    return {
        user_id: store.get_stats()
        for user_id, store in _vector_store_instances.items()
    }
