print("=== STARTING BACKEND ===")

try:
    print("1. Importing FastAPI...")
    from fastapi import FastAPI
    print("   ✓ FastAPI imported")
    
    print("2. Importing CORS...")
    from fastapi.middleware.cors import CORSMiddleware
    print("   ✓ CORS imported")
    
    print("3. Importing dotenv...")
    from dotenv import load_dotenv
    load_dotenv()
    print("   ✓ dotenv imported and loaded")
    
    print("4. Importing routes.upload...")
    from routes import upload
    print("   ✓ upload imported")
    
    print("5. Importing routes.chat...")
    from routes import chat
    print("   ✓ chat imported")
    
    print("\n✅ ALL IMPORTS SUCCESSFUL!\n")
    
    app = FastAPI()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://192.168.100.7:8080", "http://localhost:8080"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(upload.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    
    @app.get("/")
    def read_root():
        return {"message": "Backend is running!"}
    
    print("🚀 Starting server on http://0.0.0.0:8000")
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()