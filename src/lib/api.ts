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

export const sendChatMessage = async (conversationId: string, question: string, use_rag: boolean = true) => {
  const response = await api.post('/chat', {
    question,
    use_rag,
    conversation_id: conversationId,
  });
  return response.data;
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