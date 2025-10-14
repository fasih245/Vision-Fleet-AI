print("Python is running!")

from fastapi import FastAPI
print("FastAPI imported!")

from dotenv import load_dotenv
print("dotenv imported!")

import os
load_dotenv()
print("Environment loaded!")

print("GROQ_API_KEY:", "Found" if os.getenv("GROQ_API_KEY") else "Missing")

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Test successful"}

if __name__ == "__main__":
    print("Starting uvicorn...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)