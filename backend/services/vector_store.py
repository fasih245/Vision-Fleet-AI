import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import pickle
import os
from typing import List, Tuple
from langchain.schema import Document

class FAISSVectorStore:
    def __init__(self, embedding_model="all-MiniLM-L6-v2"):
        """
        Initialize FAISS vector store with sentence transformers
        
        Args:
            embedding_model: Model name from sentence-transformers
        """
        print(f"🔧 Initializing FAISS Vector Store...")
        print(f"   Model: {embedding_model}")
        
        try:
            self.embedder = SentenceTransformer(embedding_model)
            print(f"✓ Sentence transformer loaded")
        except Exception as e:
            print(f"❌ Failed to load embedding model: {e}")
            raise
        
        self.index = None
        self.documents = []
        self.index_path = "faiss_index.bin"
        self.docs_path = "faiss_docs.pkl"
        
        # Load existing index if available
        self.load_index()
        
        print(f"✓ FAISS Vector Store initialized")
        print(f"   Current vectors: {self.index.ntotal if self.index else 0}")
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Create embeddings for a list of texts
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            numpy array of embeddings (float32)
        """
        if not texts or len(texts) == 0:
            raise ValueError("Cannot create embeddings: text list is empty")
        
        # Validate texts are not empty
        valid_texts = [t for t in texts if t and t.strip()]
        if len(valid_texts) != len(texts):
            print(f"⚠️  Warning: {len(texts) - len(valid_texts)} empty texts filtered out")
            if not valid_texts:
                raise ValueError("All texts are empty after filtering")
        
        print(f"🔄 Creating embeddings for {len(valid_texts)} texts...")
        
        try:
            embeddings = self.embedder.encode(
                valid_texts,
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=False
            )
            
            # Ensure float32 format for FAISS
            embeddings = embeddings.astype('float32')
            
            print(f"✓ Created embeddings: shape {embeddings.shape}")
            
            return embeddings
            
        except Exception as e:
            print(f"❌ Embedding creation failed: {e}")
            raise
    
    def add_documents(self, documents: List[Document]) -> int:
        """
        Add documents to the FAISS index
        
        Args:
            documents: List of LangChain Document objects
            
        Returns:
            Number of documents added
        """
        if not documents or len(documents) == 0:
            print("⚠️  Warning: No documents to add to vector store")
            return 0
        
        print(f"\n{'='*60}")
        print(f"📥 Adding {len(documents)} documents to vector store")
        print(f"{'='*60}")
        
        try:
            # Extract texts and metadata
            texts = [doc.page_content for doc in documents]
            
            # Validate all texts have content
            if not all(text.strip() for text in texts):
                empty_count = sum(1 for t in texts if not t.strip())
                raise ValueError(f"{empty_count} document chunks are empty")
            
            print(f"✓ Extracted {len(texts)} text chunks")
            
            # Create embeddings
            embeddings = self.create_embeddings(texts)
            
            # Initialize index if needed
            if self.index is None:
                dimension = embeddings.shape[1]
                print(f"🔧 Creating new FAISS index (dimension: {dimension})")
                self.index = faiss.IndexFlatL2(dimension)
                print(f"✓ FAISS index created")
            
            # Verify dimensions match
            if embeddings.shape[1] != self.index.d:
                raise ValueError(
                    f"Embedding dimension mismatch: "
                    f"got {embeddings.shape[1]}, expected {self.index.d}"
                )
            
            # Add embeddings to index
            print(f"🔄 Adding embeddings to FAISS index...")
            self.index.add(embeddings)
            
            # Store documents with metadata
            self.documents.extend(documents)
            
            print(f"✓ Added {len(documents)} documents to index")
            print(f"✓ Total vectors in index: {self.index.ntotal}")
            
            # Save index and documents to disk
            self.save_index()
            
            print(f"{'='*60}\n")
            
            return len(documents)
            
        except Exception as e:
            print(f"❌ Failed to add documents: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def search(
        self,
        query: str,
        k: int = 4,
        user_id: str = None
    ) -> List[Tuple[Document, float]]:
        """
        Search for similar documents with user scoping
        
        Args:
            query: Search query text
            k: Number of results to return
            user_id: The user ID to filter by (required for security)
            
        Returns:
            List of (Document, distance) tuples
        """
        if self.index is None or self.index.ntotal == 0:
            print("⚠️  Vector store is empty")
            return []
        
        print(f"\n🔍 Searching vector store...")
        print(f"   Query: {query[:100]}...")
        print(f"   Top K: {k}")
        print(f"   User filter: {user_id}")
        
        try:
            # Create query embedding
            query_embedding = self.create_embeddings([query])
            
            # Search in FAISS
            # Fetch more candidates to allow for filtering
            # We fetch 5x the requested amount to ensure we have enough after filtering
            fetch_k = k * 5
            if fetch_k > self.index.ntotal:
                fetch_k = self.index.ntotal
                
            distances, indices = self.index.search(query_embedding, fetch_k)
            
            print(f"✓ Found {len(indices[0])} candidates (before filtering)")
            
            # Get relevant documents with user filtering
            results = []
            for i, idx in enumerate(indices[0]):
                if idx >= len(self.documents):
                    print(f"⚠️  Invalid index {idx} (total docs: {len(self.documents)})")
                    continue
                
                doc = self.documents[idx]
                distance = float(distances[0][i])
                
                # Check user access
                doc_user_id = doc.metadata.get("user_id")
                
                # Allow access if:
                # 1. Document belongs to user
                # 2. Document is public (no user_id) - optional policy
                # 3. User is admin (not implemented yet)
                if user_id and doc_user_id and doc_user_id != user_id:
                    # Skip documents belonging to other users
                    continue
                
                results.append((doc, distance))
                
                # Stop once we have enough filtered results
                if len(results) >= k:
                    break
            
            print(f"✓ Returning {len(results)} results (after filtering)")
            
            # Log top result for debugging
            if results:
                top_doc, top_dist = results[0]
                print(f"   Top result distance: {top_dist:.4f}")
                print(f"   Top result source: {top_doc.metadata.get('source', 'unknown')}")
            
            return results
            
        except Exception as e:
            print(f"❌ Search failed: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return []

    def save_index(self):
        """Save FAISS index and documents to disk"""
        try:
            if self.index is not None and self.index.ntotal > 0:
                print(f"💾 Saving vector store to disk...")
                
                # Save FAISS index
                faiss.write_index(self.index, self.index_path)
                print(f"✓ Saved FAISS index: {self.index_path}")
                
                # Save documents
                with open(self.docs_path, 'wb') as f:
                    pickle.dump(self.documents, f)
                print(f"✓ Saved documents: {self.docs_path}")
                
                # Log file sizes
                index_size = os.path.getsize(self.index_path) / 1024
                docs_size = os.path.getsize(self.docs_path) / 1024
                print(f"✓ Index size: {index_size:.1f} KB, Docs size: {docs_size:.1f} KB")
            else:
                print("⚠️  No data to save (empty index)")
                
        except Exception as e:
            print(f"❌ Failed to save index: {e}")
            import traceback
            traceback.print_exc()
    
    def load_index(self):
        """Load FAISS index and documents from disk"""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.docs_path):
                print(f"📂 Loading existing vector store...")
                
                # Load FAISS index
                self.index = faiss.read_index(self.index_path)
                print(f"✓ Loaded FAISS index: {self.index.ntotal} vectors")
                
                # Load documents
                with open(self.docs_path, 'rb') as f:
                    self.documents = pickle.load(f)
                print(f"✓ Loaded documents: {len(self.documents)} items")
                
                # Verify consistency
                if self.index.ntotal != len(self.documents):
                    print(f"⚠️  Warning: Index size ({self.index.ntotal}) != "
                          f"Document count ({len(self.documents)})")
            else:
                print("📝 No existing index found - starting fresh")
                
        except Exception as e:
            print(f"⚠️  Failed to load existing index: {e}")
            print(f"   Starting with empty index")
            self.index = None
            self.documents = []
    
    def clear_index(self):
        """Clear the vector store and delete files"""
        print(f"🗑️  Clearing vector store...")
        
        self.index = None
        self.documents = []
        
        # Delete files
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
            print(f"✓ Deleted {self.index_path}")
        
        if os.path.exists(self.docs_path):
            os.remove(self.docs_path)
            print(f"✓ Deleted {self.docs_path}")
        
        print(f"✓ Vector store cleared")
    
    def get_stats(self) -> dict:
        """Get statistics about the vector store"""
        return {
            "total_vectors": self.index.ntotal if self.index else 0,
            "total_documents": len(self.documents),
            "dimension": self.index.d if self.index else 0,
            "index_exists": self.index is not None,
            "files_exist": {
                "index": os.path.exists(self.index_path),
                "docs": os.path.exists(self.docs_path)
            }
        }