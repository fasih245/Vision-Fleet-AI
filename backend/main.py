from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, chat
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="VisionFleet RAG Backend API",
    description="AI-powered document analysis with RAG",
    version="1.0.0"
)
# ============================================================================
# CORS Configuration - MUST BE BEFORE ROUTES
# ============================================================================
app.add_middleware(
    CORSMiddleware, 
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://visionfleetai.netlify.app",  # Add your Netlify domain
        "https://unmodern-coadunate-jacque.ngrok-free.dev",  # Your ngrok domain
        "*"  # Allow all (good for development, remove in production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)
# ============================================================================
# Include API Routes
# ============================================================================
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])

# ============================================================================
# Health Check Endpoints
# ============================================================================
@app.get("/")
async def root():
    """Root endpoint - API status"""
    return {
        "message": "VisionFleet RAG Backend API is running",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    groq_key = os.getenv("GROQ_API_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    
    return {
        "status": "healthy",
        "groq_configured": bool(groq_key),
        "supabase_configured": bool(supabase_url),
        "environment": "production" if os.getenv("PRODUCTION") else "development"
    }

# ============================================================================
# Startup Event
# ============================================================================
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print("=" * 50)
    print("🚀 RAG Backend Starting...")
    print("=" * 50)
    print(f"📁 Working Directory: {os.getcwd()}")
    
    # Check GROQ API Key
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        print(f"🔑 API Key Status: ✓ Configured")
    else:
        print(f"⚠️  API Key Status: ✗ Not configured")
    
    # Check Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    if supabase_url:
        print(f"🗄️  Database Status: ✓ Configured")
    else:
        print(f"⚠️  Database Status: ✗ Not configured")
    
    print(f"📚 API Docs: http://localhost:8000/docs")
    print(f"🏥 Health Check: http://localhost:8000/health")
    print("=" * 50)

# ============================================================================
# Shutdown Event
# ============================================================================
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("\n👋 Shutting down RAG Backend...")
    print("✓ Cleanup complete")

# ============================================================================
# Main Entry Point
# ============================================================================
if __name__ == "__main__":
    print("🔧 Starting server with uvicorn...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )