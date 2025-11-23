#!/usr/bin/env python3
"""
Script to apply fixes to chat.py
"""

import re

# Read the file
with open('backend/routes/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add traceback import
content = content.replace(
    'import os\nfrom groq import Groq',
    'import os\nimport traceback\nfrom groq import Groq'
)

# Fix 2: Initialize sources at the start of the chat function
content = content.replace(
    '    """\n    try:\n        print(f"\\n📨 Received chat request:',
    '    """\n    # Initialize defaults to prevent UnboundLocalError\n    answer = None\n    sources = []\n    \n    try:\n        print(f"\\n📨 Received chat request:'
)

# Fix 3: Add sources = [] in LLM-only mode
content = content.replace(
    '            answer = completion.choices[0].message.content\n\n        # Save to Supabase',
    '            answer = completion.choices[0].message.content\n            sources = []  # No sources in LLM-only mode\n\n        # Save to Supabase'
)

# Fix 4: Add defensive check and improve error handling
content = content.replace(
    '        return ChatResponse(\n            answer=answer,\n            sources=sources,\n            conversation_id=request.conversation_id\n        )\n\n    except ValueError as ve:\n        print(f"❌ Configuration error: {ve}")\n        raise HTTPException(status_code=500, detail=f"Configuration error: {str(ve)}")\n    \n    except Exception as e:\n        traceback.print_exc()\n        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")',
    '        # Defensive check: ensure answer exists\n        if answer is None:\n            raise ValueError("Failed to generate answer")\n        \n        return ChatResponse(\n            answer=answer,\n            sources=sources,\n            conversation_id=request.conversation_id\n        )\n\n    except ValueError as ve:\n        print(f"❌ Configuration error: {ve}")\n        traceback.print_exc()\n        raise HTTPException(status_code=500, detail=f"Configuration error: {str(ve)}")\n    \n    except Exception as e:\n        print(f"❌ Chat error: {type(e).__name__}: {str(e)}")\n        traceback.print_exc()\n        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")'
)

# Write the fixed content
with open('backend/routes/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied all fixes to chat.py")
