import sys
import os
import pickle
import faiss
import numpy as np
from collections import defaultdict
from typing import List

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock Document if langchain missing
try:
    from langchain.schema import Document
except ImportError:
    class Document:
        def __init__(self, page_content, metadata=None):
            self.page_content = page_content
            self.metadata = metadata or {}

from services.vector_store import FAISSVectorStore

def migrate_documents():
    print("🚀 Starting migration of legacy documents...")
    
    docs_path = os.path.join("backend", "faiss_docs.pkl")
    
    if not os.path.exists(docs_path):
        print(f"❌ Legacy documents file not found: {docs_path}")
        return

    # 1. Load legacy documents
    print(f"📂 Loading legacy documents from {docs_path}...")
    try:
        with open(docs_path, 'rb') as f:
            documents = pickle.load(f)
        print(f"✓ Loaded {len(documents)} documents")
    except Exception as e:
        print(f"❌ Failed to load documents: {e}")
        return

    # 2. Group by user_id
    docs_by_user = defaultdict(list)
    unknown_count = 0
    
    for doc in documents:
        user_id = doc.metadata.get("user_id")
        if user_id:
            docs_by_user[user_id].append(doc)
        else:
            # Assign to 'anonymous' or 'shared' if missing
            docs_by_user["anonymous"].append(doc)
            unknown_count += 1
            
    print(f"✓ Found {len(docs_by_user)} unique users")
    if unknown_count > 0:
        print(f"⚠️  {unknown_count} documents had no user_id (assigned to 'anonymous')")

    # 3. Create new user-scoped indexes
    for user_id, user_docs in docs_by_user.items():
        print(f"\n🔄 Migrating {len(user_docs)} documents for user: {user_id}")
        
        try:
            # Initialize new store for this user
            # Note: This will create faiss_index_{user_id}.bin in the CWD or backend/ depending on where we run
            # We should run this from backend/ directory or adjust paths in vector_store.py
            # For now, let's assume vector_store.py handles paths relative to CWD
            
            store = FAISSVectorStore(user_id=user_id)
            
            # Add documents (this will re-embed them)
            # Optimization: If we could extract embeddings from old index, that would be faster.
            # But mapping index ID to document is tricky without the index wrapper.
            # Re-embedding is safer and ensures consistency.
            
            store.add_documents(user_docs)
            print(f"✅ Successfully migrated user: {user_id}")
            
        except Exception as e:
            print(f"❌ Failed to migrate user {user_id}: {e}")

    print("\n✨ Migration complete!")

if __name__ == "__main__":
    migrate_documents()
