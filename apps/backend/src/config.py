"""Hinglish: Central config — env se cheezen read karo yahan se import hoti rahegi."""
from pydantic import BaseModel
from dotenv import load_dotenv
import os


load_dotenv()


class Settings(BaseModel):
 database_url: str = os.getenv("DATABASE_URL", "")
 hf_token: str = os.getenv("HF_TOKEN", "")
 base_model: str = os.getenv("BASE_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct")
 lora_out: str = os.getenv("LORA_OUT", "./artifacts/lora-llama3-sql")
 embed_model: str = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
 chroma_dir: str = os.getenv("CHROMA_DIR", ".chroma")


settings = Settings()