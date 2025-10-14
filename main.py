from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, chat
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="RAG API with FAISS")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # Your React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "RAG Backend with FAISS is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)