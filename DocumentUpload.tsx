import { useState } from 'react';
import { uploadDocument } from '@/lib/api';
import { dbOperations } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export const DocumentUpload = () => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // First, save document metadata to Supabase
      const doc = await dbOperations.saveDocument(
        file.name,
        '', // Content will be populated after processing
        'file',
        file.name,
        file.size,
        file.type
      );

      // Upload to backend (FAISS)
      const response = await uploadDocument(file);

      // Update document with processing results
      await dbOperations.updateDocumentProcessing(
        doc.id,
        response.chunks_created,
        true
      );

      alert(`Successfully uploaded ${file.name}! Created ${response.chunks_created} chunks.`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4">
      <input
        type="file"
        accept=".pdf,.docx,.txt,.csv"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload">
        <Button as="span" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </label>
    </div>
  );
};