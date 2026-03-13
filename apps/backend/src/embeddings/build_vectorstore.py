"""Hinglish: Chroma vector store build — schema docs + helpful prompts ko embed karo."""
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.config import settings
import os


DOCS = [
# Hinglish: Real project mein yahan Argo/BGC docs add karo.
 ("schema", "floats(float_id, wmo_id, platform, deployment_date, last_seen, last_lat, last_lon, region)\n"
 "profiles(profile_id, float_id, time, lat, lon, cycle, qc)\n"
 "measurements(id, profile_id, depth_m, temperature_c, salinity_psu, oxygen_mmol_kg, chla_mg_m3)"),
 ("primer", "Common queries: equator lat between -5 and 5; Arabian Sea lon 40-75 lat 5-25; time filters etc."),
]


def main():
 embed = HuggingFaceEmbeddings(model_name=settings.embed_model)
 texts = []
 metadatas = []
 for title, content in DOCS:
  splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
  for chunk in splitter.split_text(content):
   texts.append(chunk)
   metadatas.append({"source": title})


 os.makedirs(settings.chroma_dir, exist_ok=True)
 Chroma.from_texts(texts, embedding=embed, metadatas=metadatas, persist_directory=settings.chroma_dir)
 print("Chroma store built at", settings.chroma_dir)


if __name__ == "__main__":
 main()