from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, chat
import gradio as gr
import uvicorn
import os
from dotenv import load_dotenv

# Set when running on a Hugging Face Space — used to auto-adapt the port
# and disable dev-only behavior (reload) without needing separate config.
_on_hf_space = bool(os.getenv("SPACE_ID"))

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
# Hugging Face Spaces (Gradio SDK) requires *something* Gradio-shaped to be
# present — this placeholder tab exists only to satisfy that, and is mounted
# under /gradio so it never shadows the real API routes above. The actual
# app is the FastAPI REST API, used exactly as it is locally.
# ============================================================================
def _status_tab(_: str) -> str:
    return "VisionFleet backend is running. The real API is at /api/* — this tab only exists to satisfy Hugging Face's Gradio SDK requirement."

_gradio_placeholder = gr.Interface(
    fn=_status_tab,
    inputs=gr.Textbox(label="(unused)"),
    outputs=gr.Textbox(label="Status"),
    title="VisionFleet Backend",
    description="This Space hosts the VisionFleet REST API, not a chat UI. See /docs (dev only) or /health.",
)
app = gr.mount_gradio_app(app, _gradio_placeholder, path="/gradio")

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
    # Hugging Face Spaces expects the app on port 7860 and doesn't want
    # reload (a dev-only feature); local runs keep the old defaults.
    port = int(os.getenv("PORT", "7860" if _on_hf_space else "8000"))

    print("\n🔧 Starting server with uvicorn...")
    print("Press CTRL+C to stop\n")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not _on_hf_space,
        log_level="info",
        access_log=True
    )