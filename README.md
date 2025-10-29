# VisionFleet AI - Intelligent Document Analysis Platform

<div align="center">

![VisionFleet AI](https://img.shields.io/badge/VisionFleet-AI-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10-green?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18.2-blue?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-teal?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

*AI-powered document analysis using Retrieval-Augmented Generation (RAG)*

[Features](#features) • [Architecture](#architecture) • [Installation](#installation) • [Usage](#usage) • [Tech Stack](#tech-stack)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Workflow](#workflow)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 Overview

**VisionFleet AI** is an advanced document analysis platform that leverages **Retrieval-Augmented Generation (RAG)** to enable intelligent conversations with your documents. Upload PDFs, DOCX, TXT, or CSV files, and ask questions in natural language to extract insights instantly.

### Key Capabilities:
- 📄 **Multi-format document processing** (PDF, DOCX, TXT, CSV)
- 🔍 **Semantic search** using FAISS vector database
- 🤖 **AI-powered responses** via Groq LLM (Llama 3.3)
- 🔐 **User authentication** and document isolation
- 💬 **Dual chat modes**: RAG-enabled and conventional LLM
- 📊 **Source attribution** for transparent responses

---

## ✨ Features

### 🚀 Core Features
- **Document Upload & Processing**: Supports PDF, DOCX, TXT, and CSV files
- **Intelligent Chunking**: Automatically splits documents into semantic chunks
- **Vector Embeddings**: Uses Sentence Transformers for semantic understanding
- **FAISS Vector Store**: Lightning-fast similarity search
- **RAG Pipeline**: Combines document context with LLM generation
- **User Isolation**: Each user's documents are private and secure
- **Conversation History**: Persistent chat sessions stored in Supabase

### 🎯 Advanced Features
- **Hybrid Search Mode**: FAISS + Supabase for redundancy
- **RAG Toggle**: Switch between RAG and conventional LLM on-the-fly
- **Source Citations**: Every answer links back to source documents
- **Real-time Processing**: Instant document indexing and retrieval
- **Responsive Design**: Works seamlessly on desktop and mobile

---

## 🏗️ Architecture

### High-Level Architecture