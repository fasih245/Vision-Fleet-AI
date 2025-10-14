import os
from typing import List
import PyPDF2
from docx import Document
import pandas as pd
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document as LangchainDoc

class DocumentProcessor:
    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
    
    def process_pdf(self, file_path: str) -> str:
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text()
        return text
    
    def process_docx(self, file_path: str) -> str:
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    
    def process_txt(self, file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    
    def process_csv(self, file_path: str) -> str:
        df = pd.read_csv(file_path)
        return df.to_string()
    
    def process_file(self, file_path: str, filename: str) -> List[LangchainDoc]:
        # Extract text based on file type
        if filename.endswith('.pdf'):
            text = self.process_pdf(file_path)
        elif filename.endswith('.docx'):
            text = self.process_docx(file_path)
        elif filename.endswith('.txt'):
            text = self.process_txt(file_path)
        elif filename.endswith('.csv'):
            text = self.process_csv(file_path)
        else:
            raise ValueError(f"Unsupported file type: {filename}")
        
        # Split into chunks
        chunks = self.text_splitter.split_text(text)
        
        # Create Document objects with metadata
        documents = [
            LangchainDoc(
                page_content=chunk,
                metadata={"source": filename, "chunk_index": i}
            )
            for i, chunk in enumerate(chunks)
        ]
        
        return documents