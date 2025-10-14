import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const sendChatMessage = async (question: string, useRag: boolean = true) => {
  const response = await api.post('/chat', { 
    question, 
    use_rag: useRag 
  });
  return response.data;
};
export const clearDocuments = async () => {
  const response = await api.delete('/clear');
  return response.data;
};

export default api;