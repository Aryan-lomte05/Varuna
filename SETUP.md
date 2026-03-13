# 🌊 FloatChat AI — Partner Setup Guide

Welcome to the FloatChat AI research platform! This guide will help you get the system running locally for ingestion, database management, and API development.

## 🛠️ Prerequisites

Ensure you have the following installed:
- **Python 3.11+**
- **Node.js 20+**
- **PostgreSQL 15+** with **PostGIS** extension
- **Redis** (Local or cloud)
- **Qdrant** (Vector Database)
- **Ollama** (For local LLM inference)

## 🚀 Quick Start (Local Setup)

### 1. Database & Infrastructure
If you prefer not to use Docker, ensure your local Postgres has a database named `floatchat`. 
Run the following SQL to enable PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. API Backend
Go to `services/api`:
1. Create a virtual environment: `python -m venv venv`
2. Activate it: `.\venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r requirements.txt`
4. Run the local starter: `.\start_local.ps1`

**FastAPI Docs:** Once running, visit [http://localhost:8000/docs](http://localhost:8000/docs) to test all endpoints.

### 3. API Gateway
Go to `services/gateway`:
1. Install deps: `npm install`
2. Run the local starter: `.\start_local.ps1`

### 4. Frontend Dashboard
Go to `apps/web`:
1. Create `.env.local` and add: `NEXT_PUBLIC_MAPBOX_TOKEN=your_token`
2. Install deps: `npm install`
3. Start dev server: `npm run dev`

---

## 🧪 Data Ingestion & Seeding

### Seeding Mock Data
To quickly test the UI with ARGO data near Mumbai and Maldives:
```bash
cd services/api
.\venv\Scripts\python.exe seed_mock_data.py
```

### Ingesting Real NetCDF Data
Place your `.nc` files in a directory and run:
```bash
# Example command (adjust based on pipeline.py logic)
.\venv\Scripts\python.exe -m src.ingestion.pipeline --data-dir C:\path\to\data
```

---

## 🗺️ Mapbox API Key
1. Sign up at [mapbox.com](https://account.mapbox.com/) (Free tier is generous).
2. Grab your **Public Token**.
3. Add it to `apps/web/.env.local`.

## 📦 Project Structure
- `apps/web`: Next.js frontend with 3D Globe & Plotly charts.
- `services/api`: FastAPI RAG backend with Ollama & PostGIS.
- `services/gateway`: Node.js proxy/auth layer.
- `data/`: Processed oceanic datasets.

---
🚀 **FloatChat AI — Science-first oceanic intelligence.**
