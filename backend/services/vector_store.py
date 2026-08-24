import os
import uuid
from typing import List, Tuple, Optional
from pinecone import Pinecone
from langchain.schema import Document


class PineconeVectorStore:
    """Vector store backed by a Pinecone index with integrated embedding
    (the index itself converts text -> vectors server-side, using the model
    configured on the index — no local embedding model needed).

    Isolation model: one Pinecone *namespace* per user_id, mirroring the
    old one-FAISS-file-per-user_id design. Namespaces keep each user's
    vectors fully separate within the same index.
    """

    def __init__(self, user_id: Optional[str] = None):
        self.user_id = user_id or "shared"
        self.namespace = self.user_id

        api_key = os.getenv("PINECONE_API_KEY")
        index_name = os.getenv("PINECONE_INDEX_NAME")

        if not api_key or not index_name:
            raise ValueError("PINECONE_API_KEY and PINECONE_INDEX_NAME must be set in the environment")

        print(f"🔧 Initializing Pinecone vector store for user: {self.user_id}")
        self.pc = Pinecone(api_key=api_key)
        self.index = self.pc.Index(name=index_name)
        print(f"   Namespace: {self.namespace}")

    def add_documents(self, documents: List[Document]) -> int:
        """
        Add documents to this user's Pinecone namespace.

        Args:
            documents: List of LangChain Document objects

        Returns:
            Number of chunks upserted
        """
        if not documents or len(documents) == 0:
            print("⚠️  Warning: No documents to add to vector store")
            return 0

        # SECURITY CHECK: same discipline as the old FAISS store — verify
        # every document actually belongs to this user before it lands in
        # this namespace.
        for doc in documents:
            doc_user_id = doc.metadata.get("user_id")
            if doc_user_id and doc_user_id != self.user_id and self.user_id != "shared":
                raise ValueError(
                    f"Security violation: Attempting to add document with user_id={doc_user_id} "
                    f"to vector store scoped to user_id={self.user_id}"
                )

        print(f"\n{'='*60}")
        print(f"📥 Adding {len(documents)} documents to Pinecone (User: {self.user_id})")
        print(f"{'='*60}")

        records = []
        for i, doc in enumerate(documents):
            text = doc.page_content
            if not text or not text.strip():
                continue

            records.append({
                "_id": str(uuid.uuid4()),
                # "text" must match the field configured on the index
                # ("Field map" in the Pinecone console) — this is the field
                # Pinecone actually embeds.
                "text": text,
                "source": doc.metadata.get("source", "Unknown"),
                "document_id": str(doc.metadata.get("document_id", "unknown")),
                "chunk_index": doc.metadata.get("chunk_index", i),
            })

        if not records:
            raise ValueError("All document chunks are empty")

        try:
            # Pinecone caps how many records can go in one upsert_records
            # call — chunk defensively rather than assume a document never
            # produces more than that many chunks.
            BATCH_SIZE = 90
            for start in range(0, len(records), BATCH_SIZE):
                batch = records[start:start + BATCH_SIZE]
                self.index.upsert_records(namespace=self.namespace, records=batch)
                print(f"✓ Upserted batch of {len(batch)} chunks")

            print(f"✓ Total {len(records)} chunks upserted to namespace '{self.namespace}'")
            print(f"{'='*60}\n")

            return len(records)

        except Exception as e:
            print(f"❌ Failed to add documents: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise

    def search(
        self,
        query: str,
        k: int = 4,
        user_id: Optional[str] = None
    ) -> List[Tuple[Document, float]]:
        """
        Search for similar documents in this user's namespace.

        Args:
            query: Search query text (embedded server-side by Pinecone)
            k: Number of results to return
            user_id: DEPRECATED — isolation is at the namespace level

        Returns:
            List of (Document, score) tuples. Score is cosine similarity —
            HIGHER means more relevant (opposite direction from the old
            FAISS L2-distance scores, where lower meant more relevant).
        """
        if not query or not query.strip():
            print("⚠️  Empty query")
            return []

        if user_id and user_id != self.user_id:
            print(f"⚠️  Warning: search() user_id parameter ({user_id}) doesn't match "
                  f"vector store scope ({self.user_id}). This namespace only contains "
                  f"documents for user {self.user_id}.")

        print(f"\n🔍 Searching Pinecone...")
        print(f"   Query: {query[:100]}...")
        print(f"   Top K: {k}")
        print(f"   Namespace: {self.namespace}")

        try:
            results = self.index.search(
                namespace=self.namespace,
                inputs={"text": query},
                top_k=k,
                fields=["text", "source", "document_id", "chunk_index"],
            )

            hits = results["result"]["hits"] if isinstance(results, dict) else results.result.hits
            print(f"✓ Found {len(hits)} results")

            output: List[Tuple[Document, float]] = []
            for hit in hits:
                fields = hit.fields  # plain dict on the SDK's Hit object
                score = float(hit.score)

                doc = Document(
                    page_content=fields.get("text", ""),
                    metadata={
                        "source": fields.get("source", "Unknown"),
                        "document_id": fields.get("document_id", "unknown"),
                        "chunk_index": fields.get("chunk_index", 0),
                    },
                )
                output.append((doc, score))

            # Don't assume the SDK returns hits pre-sorted by relevance —
            # observed empirically that it doesn't always. Sort explicitly
            # (higher cosine score = more relevant) so downstream code can
            # safely rely on best-match-first ordering.
            output.sort(key=lambda pair: pair[1], reverse=True)

            if output:
                print(f"   Top result score: {output[0][1]:.4f}")
                print(f"   Top result source: {output[0][0].metadata.get('source', 'unknown')}")

            return output

        except Exception as e:
            print(f"❌ Search failed: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return []

    def clear_index(self):
        """Delete all vectors in this user's namespace."""
        print(f"🗑️  Clearing Pinecone namespace for user {self.user_id}...")
        try:
            self.index.delete(namespace=self.namespace, delete_all=True)
            print(f"✓ Namespace '{self.namespace}' cleared")
        except Exception as e:
            # Pinecone errors if the namespace doesn't exist yet (e.g. a
            # user who never uploaded anything) — not a real failure.
            print(f"⚠️  Nothing to clear (namespace may not exist yet): {e}")

    def get_stats(self) -> dict:
        """Get statistics about this user's namespace."""
        try:
            stats = self.index.describe_index_stats()
            ns_stats = stats.get("namespaces", {}).get(self.namespace, {})
            return {
                "user_id": self.user_id,
                "namespace": self.namespace,
                "total_vectors": ns_stats.get("vector_count", 0),
            }
        except Exception as e:
            print(f"⚠️  Failed to get stats: {e}")
            return {"user_id": self.user_id, "namespace": self.namespace, "total_vectors": 0}
