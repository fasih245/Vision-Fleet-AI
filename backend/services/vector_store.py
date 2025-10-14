import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import pickle
import os
from typing import List, Tuple

class FAISSVectorStore:
    def __init__(self, embedding_model="all-MiniLM-L6-v2"):
        self.embedder = SentenceTransformer(embedding_model)
        self.index = None
        self.documents = []
        self.index_path = "faiss_index"
        self.docs_path = "faiss_docs.pkl"
        
        # Load existing index if available
        self.load_index()
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """Convert texts to embeddings"""
        embeddings = self.embedder.encode(texts, show_progress_bar=True)
        return embeddings.astype('float32')
    
    def add_documents(self, documents):
        """Add documents to the FAISS index"""
        # Extract texts from documents
        texts = [doc.page_content for doc in documents]
        
        # Create embeddings
        embeddings = self.create_embeddings(texts)
        
        # Initialize or add to index
        if self.index is None:
            dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatL2(dimension)
        
        # Add embeddings to index
        self.index.add(embeddings)
        
        # Store documents
        self.documents.extend(documents)
        
        # Save index and documents
        self.save_index()
        
        return len(documents)
    
    def search(self, query: str, k: int = 4) -> List[Tuple]:
        """Search for similar documents"""
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Create query embedding
        query_embedding = self.create_embeddings([query])
        
        # Search in FAISS
        distances, indices = self.index.search(query_embedding, k)
        
        # Get relevant documents
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.documents):
                results.append((
                    self.documents[idx],
                    float(distances[0][i])
                ))
        
        return results
    
    def save_index(self):
        """Save FAISS index and documents to disk"""
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
            with open(self.docs_path, 'wb') as f:
                pickle.dump(self.documents, f)
    
    def load_index(self):
        """Load FAISS index and documents from disk"""
        if os.path.exists(self.index_path) and os.path.exists(self.docs_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.docs_path, 'rb') as f:
                self.documents = pickle.load(f)
            print(f"Loaded {self.index.ntotal} vectors from index")
    
    def clear_index(self):
        """Clear the vector store"""
        self.index = None
        self.documents = []
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.docs_path):
            os.remove(self.docs_path)