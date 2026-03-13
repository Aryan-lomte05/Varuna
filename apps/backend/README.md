# FloatChatAI — AIML Backend


**What this does**
- NL query → (RAG over schema + docs) → LLaMA (LoRA) → SQL
- Runs SQL on Postgres, pretty-prints results, and emits **viz specs** for frontend graphs/maps
- Semantic search (Chroma) over schema/helptext/metadata
- FastAPI server ready for frontend integration
- Optional MCP tool server (model-context-protocol) exposing `run_sql`, `get_schema`, `semantic_search`


## Quickstart


### 1) Python env
```bash
python -m venv .venv && . .venv/bin/activate # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt