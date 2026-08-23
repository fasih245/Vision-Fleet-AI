from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, chat
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

_is_production = bool(os.getenv("PRODUCTION"))

# Create FastAPI app
app = FastAPI(
    title="VisionFleet RAG Backend API",
    description="AI-powered document analysis with RAG",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# ============================================================================
# CORS Configuration - MUST BE BEFORE ROUTES
# ============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",

        # Production - Add your actual Netlify URL
        "https://visionfleetai.netlify.app",
        "https://*.netlify.app",  # All Netlify preview deployments

        # Ngrok
        "https://unmodern-coadunate-jacque.ngrok-free.dev",
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
        "docs": "/docs" if not _is_production else None,
        "health": "/health"
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
        "environment": "production" if os.getenv("PRODUCTION") else "development",
        "cors_enabled": True
    }

# ============================================================================
# Startup Event
# ============================================================================
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print("\n" + "=" * 60)
    print("🚀 VisionFleet RAG Backend Starting...")
    print("=" * 60)
    print(f"📁 Working Directory: {os.getcwd()}")
    
    # Check GROQ API Key
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        print(f"🔑 GROQ API Key: ✓ Configured")
    else:
        print(f"⚠️  GROQ API Key: ✗ Not configured")
    
    # Check Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    if supabase_url:
        print(f"🗄️  Supabase: ✓ Configured")
        print(f"   URL: {supabase_url}")
    else:
        print(f"⚠️  Supabase: ✗ Not configured")
    
    # Check CORS
    print(f"🌐 CORS: ✓ Restricted to allowlisted origins")

    if not _is_production:
        print(f"\n📚 API Documentation: http://localhost:8000/docs")
    print(f"🏥 Health Check: http://localhost:8000/health")
    print(f"🌍 Root: http://localhost:8000/")
    print("=" * 60 + "\n")

# ============================================================================
# Shutdown Event
# ============================================================================
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("\n" + "=" * 60)
    print("👋 Shutting down VisionFleet RAG Backend...")
    print("✓ Cleanup complete")
    print("=" * 60 + "\n")

# ============================================================================
# Main Entry Point
# ============================================================================
if __name__ == "__main__":
    print("\n🔧 Starting server with uvicorn...")
    print("Press CTRL+C to stop\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )