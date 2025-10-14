from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_service import RAGService
from services.vector_store import FAISSVectorStore

router = APIRouter()
vector_store = FAISSVectorStore()
rag_service = RAGService(vector_store)

class QueryRequest(BaseModel):
    question: str

@router.post("/chat")
async def chat(request: QueryRequest):
    try:
        response = rag_service.generate_response(request.question)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clear")
async def clear_index():
    """Clear all documents from the vector store"""
    vector_store.clear_index()
    return {"message": "Vector store cleared successfully"} 