import axios from 'axios';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

interface StreamChatHandlers {
  onChunk: (text: string) => void;
  onDone: (payload: { sources: any[]; conversation_id: string | null }) => void;
  onError: (message: string) => void;
}

// Streams the /chat response as it's generated (Server-Sent Events) instead
// of waiting for the full answer — dispatches to the given handlers as
// frames arrive. Uses fetch directly since axios doesn't expose a
// ReadableStream-friendly API for arbitrary SSE parsing.
export const streamChatMessage = async (
  params: { question: string; use_rag: boolean; conversation_id: string },
  handlers: StreamChatHandlers
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(params),
    });
  } catch (error) {
    handlers.onError('Could not reach the server');
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError(`Request failed (${response.status})`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; keep any incomplete
    // trailing frame in the buffer for the next chunk.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data: ')) continue;

      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.type === 'chunk') {
          handlers.onChunk(payload.content);
        } else if (payload.type === 'done') {
          handlers.onDone({
            sources: payload.sources || [],
            conversation_id: payload.conversation_id ?? null,
          });
        } else if (payload.type === 'error') {
          handlers.onError(payload.message || 'Something went wrong');
        }
      } catch (parseError) {
        console.error('Failed to parse chat stream frame:', parseError, line);
      }
    }
  }
};

export const loadConversationMessages = async (conversationId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await axios.get(
      `${API_URL}/conversations/${conversationId}/messages`,
      {
        headers: {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : undefined,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    // If 404, conversation has no messages yet - that's OK
    if (error.response?.status === 404) {
      console.log('No messages yet for this conversation');
      return { messages: [], count: 0, conversation_id: conversationId };
    }

    console.error('Error loading messages:', error);
    // Return empty instead of throwing
    return { messages: [], count: 0, conversation_id: conversationId };
  }
};

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};