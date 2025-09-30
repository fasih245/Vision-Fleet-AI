-- Update the existing vector index to fix the extension issue
-- We need to recreate the index with the correct schema reference
DROP INDEX IF EXISTS idx_document_chunks_embedding;

-- Create vector similarity index for embeddings using the correct schema
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);