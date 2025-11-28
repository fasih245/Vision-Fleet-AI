import sys
import os
# Mock Document class since langchain is missing
class Document:
    def __init__(self, page_content, metadata=None):
        self.page_content = page_content
        self.metadata = metadata or {}

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from services.vector_store import FAISSVectorStore

def test_rag_flow():
    user_id = "test_user_123"
    print(f"🔍 Testing RAG flow for user: {user_id}")
    
    # 1. Initialize Vector Store
    try:
        store = FAISSVectorStore(user_id=user_id)
        print("✅ Vector Store initialized")
    except Exception as e:
        print(f"❌ Failed to initialize Vector Store: {e}")
        return

    # 2. Add Document
    docs = [
        Document(
            page_content="The secret code is BLUE-HORIZON-99.",
            metadata={"source": "secret.txt", "user_id": user_id}
        )
    ]
    
    print("\n📤 Adding document...")
    try:
        count = store.add_documents(docs)
        print(f"✅ Added {count} documents")
    except Exception as e:
        print(f"❌ Failed to add documents: {e}")
        return

    # 3. Verify Files Exist
    index_path = f"faiss_index_{user_id}.bin"
    docs_path = f"faiss_docs_{user_id}.pkl"
    
    if os.path.exists(index_path) and os.path.exists(docs_path):
        print(f"✅ Index files created: {index_path}, {docs_path}")
    else:
        print(f"❌ Index files MISSING: {index_path}, {docs_path}")

    # 4. Search
    query = "What is the secret code?"
    print(f"\n🔎 Searching for: '{query}'")
    try:
        results = store.search(query, k=1)
        if results:
            print(f"✅ Found {len(results)} results")
            print(f"   Top result: {results[0][0].page_content}")
        else:
            print("❌ No results found!")
    except Exception as e:
        print(f"❌ Search failed: {e}")

    # 5. Test Persistence (Reload)
    print("\n🔄 Testing persistence (reloading store)...")
    try:
        new_store = FAISSVectorStore(user_id=user_id)
        results = new_store.search(query, k=1)
        if results:
            print(f"✅ Persistence working. Found: {results[0][0].page_content}")
        else:
            print("❌ Persistence FAILED. No results after reload.")
    except Exception as e:
        print(f"❌ Reload failed: {e}")

    # Cleanup
    # os.remove(index_path)
    # os.remove(docs_path)

if __name__ == "__main__":
    test_rag_flow()
