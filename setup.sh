#!/bin/bash

# Backend Setup
echo "Setting up Python backend..."
conda create -n rag-backend python=3.10 -y
conda activate rag-backend
cd backend
pip install -r requirements.txt

# Frontend Setup
echo "Setting up React frontend..."
conda create -n rag-frontend -c conda-forge nodejs=20 -y
conda activate rag-frontend
cd ..
npm install