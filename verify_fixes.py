import sys
import os
from unittest.mock import MagicMock

# Mock heavy dependencies
sys.modules["numpy"] = MagicMock()
sys.modules["faiss"] = MagicMock()
sys.modules["sentence_transformers"] = MagicMock()
sys.modules["groq"] = MagicMock()
sys.modules["supabase"] = MagicMock()

# Mock langchain.schema
mock_langchain = MagicMock()
mock_doc = MagicMock()
mock_langchain.schema.Document = mock_doc
sys.modules["langchain"] = mock_langchain
sys.modules["langchain.schema"] = MagicMock()
sys.modules["langchain.schema"].Document = dict  # Use dict as simple Document replacement

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Now import the code to test
from services.vector_store import FAISSVectorStore
from services.dependencies import get_vector_store

# Mock the internal methods of FAISSVectorStore to avoid needing real FAISS
def mock_create_embeddings(self, texts):
    # Return fake embeddings
    import numpy as np
    return MagicMock(shape=(len(texts), 384))

FAISSVectorStore.create_embeddings = mock_create_embeddings

def test_hot_reload_and_scoping():
    print("Starting Verification Test (with mocks)...")
    
    # 1. Get Singleton Instance
    store = get_vector_store()
    
    # Mock the index
    store.index = MagicMock()
    store.index.ntotal = 10
    store.index.d = 384
    
    # Mock search results from FAISS
    # We simulate FAISS returning indices [0, 1]
    # Index 0: User A's doc
    # Index 1: User B's doc
    store.index.search.return_value = (
        [[0.1, 0.2]], # distances
        [[0, 1]]      # indices
    )
    
    # Setup documents in store
    doc_a = MagicMock()
    doc_a.page_content = "User A Document"
    doc_a.metadata = {"user_id": "user_A", "source": "alpha.txt"}
    
    doc_b = MagicMock()
    doc_b.page_content = "User B Document"
    doc_b.metadata = {"user_id": "user_B", "source": "beta.txt"}
    
    store.documents = [doc_a, doc_b]
    
    # 2. Verify Singleton
    store2 = get_vector_store()
    if store is store2:
        print("PASS: Singleton pattern working.")
    else:
        print("FAIL: Singleton pattern failed.")
        
    # 3. Verify User Scoping (User B searching)
    print("\nTesting User Scoping (User B searching)...")
    # Should only find doc_b (index 1)
    results_b = store.search("query", k=2, user_id="user_B")
    
    found_b = False
    found_a = False
    for doc, score in results_b:
        if doc.metadata["user_id"] == "user_B":
            found_b = True
        if doc.metadata["user_id"] == "user_A":
            found_a = True
            
    if found_b and not found_a:
        print("PASS: User B only found their own document.")
    else:
        print(f"FAIL: User Scoping failed. Found B: {found_b}, Found A: {found_a}")
        
    # 4. Verify User Scoping (User A searching)
    print("\nTesting User Scoping (User A searching)...")
    results_a = store.search("query", k=2, user_id="user_A")
    
    found_b = False
    found_a = False
    for doc, score in results_a:
        if doc.metadata["user_id"] == "user_B":
            found_b = True
        if doc.metadata["user_id"] == "user_A":
            found_a = True
            
    if found_a and not found_b:
        print("PASS: User A only found their own document.")
    else:
        print(f"FAIL: User Scoping failed. Found B: {found_b}, Found A: {found_a}")

if __name__ == "__main__":
    try:
        test_hot_reload_and_scoping()
        print("\nAll tests completed.")
    except Exception as e:
        print(f"\nTest crashed: {e}")
        import traceback
        traceback.print_exc()
