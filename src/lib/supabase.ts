import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const dbOperations = {
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  signUp: async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  createConversation: async (title?: string) => {
    const user = await dbOperations.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: title || 'New Chat' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getConversations: async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  updateConversation: async (conversationId: string, updates?: any) => {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteConversation: async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
  },

  saveMessage: async (
    conversationId: string,
    userMessage: string,
    botResponse: string,
    retrievedChunks?: any,
    responseTimeMs?: number,
    modelUsed?: string
  ) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_message: userMessage,
        bot_response: botResponse,
        retrieved_chunks: retrievedChunks,
        response_time_ms: responseTimeMs,
        model_used: modelUsed || 'llama-3.1-70b-versatile',  // Changed from mixtral,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getMessages: async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  saveDocument: async (
    title: string,
    content: string,
    sourceType: 'file' | 'url' | 'text',
    sourcePath?: string,
    fileSize?: number,
    fileType?: string,
    metadata?: any
  ) => {
    const user = await dbOperations.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title,
        content,
        source_type: sourceType,
        source_path: sourcePath,
        file_size: fileSize,
        file_type: fileType,
        metadata,
        is_processed: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getDocuments: async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  updateDocumentProcessing: async (
    documentId: string,
    chunkCount: number,
    isProcessed: boolean
  ) => {
    const { data, error } = await supabase
      .from('documents')
      .update({
        chunk_count: chunkCount,
        is_processed: isProcessed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteDocument: async (documentId: string) => {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
};

export default supabase;