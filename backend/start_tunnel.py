from pyngrok import ngrok
import time
import sys

# IMPORTANT: Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
AUTH_TOKEN = "2xa7fs7InQWYE4sMIu8ZbL4Oii8_55MPSNVFASac3UK5K8SAq"  # Replace with your actual token

# Set authtoken
ngrok.set_auth_token(AUTH_TOKEN)

# Start tunnel on port 8000
print("🚀 Starting ngrok tunnel...")
try:
    http_tunnel = ngrok.connect(8000, bind_tls=True)
    
    print("\n" + "="*60)
    print("🌐 NGROK TUNNEL ACTIVE")
    print("="*60)
    print(f"📍 Public URL: {http_tunnel.public_url}")
    print(f"🔗 Use this in Netlify: {http_tunnel.public_url}/api")
    print("="*60)
    print("\n✅ Tunnel is running. Press Ctrl+C to stop.\n")
    
    # Keep tunnel alive
    while True:
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\n\n❌ Stopping tunnel...")
    ngrok.kill()
    print("✅ Tunnel stopped successfully")
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nMake sure:")
    print("1. You've replaced AUTH_TOKEN with your actual token")
    print("2. Backend is running on port 8000")
    print("3. pyngrok is installed: pip install pyngrok")
    sys.exit(1)