# """Hinglish: CLI tester — NL in, SQL out + summary."""
# import sys
# from src.chains.sql_rag_chain import answer

# if __name__ == "__main__":
#     q = " ".join(sys.argv[1:]) or "Show me psal vs pres near the equator in March 2023 including temp and coords"
#     resp = answer(q)
#     print(resp["answer_markdown"])  # Pretty output for quick sanity check
# -*- coding: utf-8 -*-
# Hinglish: Inference utility — base + LoRA adapter load, single place se call karo.

from __future__ import annotations
import os
from typing import List, Dict, Any, Optional

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel

LORA_PATH = os.getenv("LORA_OUT", "artifacts/lora-marine-qwen3b")
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")

_device = "cuda" if torch.cuda.is_available() else "cpu"

# Hinglish: model lazy global — ek hi baar load hoga
_tokenizer = None
_model = None

def _load():
    global _tokenizer, _model
    if _model is not None:
        return
    _tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    if _tokenizer.pad_token is None:
        _tokenizer.pad_token = _tokenizer.eos_token

    # Hinglish: runtime me memory bachane ke liye 4bit nahi chahiye — inference normal
    _model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        device_map="auto",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        trust_remote_code=True,
    )
    if LORA_PATH and os.path.isdir(LORA_PATH):
        _model = PeftModel.from_pretrained(_model, LORA_PATH)
    _model.eval()

def _gen(
    system: str,
    user: str,
    max_new_tokens: int = 256,
    temperature: float = 0.2,
    top_p: float = 0.9,
) -> str:
    # Hinglish: simple chat prompt — system + user
    _load()
    assert _tokenizer and _model
    prompt = f"[SYSTEM]\n{system}\n\n[USER]\n{user}\n\n[ASSISTANT]\n"
    inputs = _tokenizer(prompt, return_tensors="pt").to(_model.device)
    gen_cfg = GenerationConfig(
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_p=top_p,
        do_sample=False if temperature <= 0.01 else True,
        pad_token_id=_tokenizer.pad_token_id,
        eos_token_id=_tokenizer.eos_token_id,
    )
    with torch.no_grad():
        out = _model.generate(**inputs, generation_config=gen_cfg)
    text = _tokenizer.decode(out[0], skip_special_tokens=True)
    # Hinglish: assistant ke baad ka hissa nikaal lo
    cut = text.split("[ASSISTANT]")[-1].strip()
    return cut

SQL_SYS = (
    "You are FLOATCHATAI 🌊—propose ONE valid PostgreSQL query only, "
    "inside a single ```sql fenced block``` with no commentary. "
    "Use table public.marine_data with columns: platform_number, time, latitude, longitude, "
    "temp, psal, doxy, chla, ph_in_situ_total, nitrate, pres. Always add sensible WHERE time windows if asked, "
    "and include platform_number, time, latitude, longitude in SELECT for context when doing min/max/top-k."
)

BEAUTIFY_SYS = (
    "You are a concise ocean-data analyst who writes clear English summaries. "
    "Given a SQL result and context, write 2-4 clean sentences: what was asked, what was found "
    "(with float id and lat/lon/time if available), and a short interpretation. No SQL in the answer."
)

def generate_sql(user: str) -> str:
    # Hinglish: SQL model inference
    return _gen(SQL_SYS, user, max_new_tokens=256, temperature=0.05)

def beautify(context_user: str, sql: str, rows: List[Dict[str, Any]]) -> str:
    # Hinglish: rows ko short text me pack karo, phir polish karao
    rows_preview = rows[:5]
    return _gen(
        BEAUTIFY_SYS,
        f"Question: {context_user}\nSQL:\n{sql}\nTop rows JSON:\n{rows_preview}",
        max_new_tokens=200,
        temperature=0.2,
    )
