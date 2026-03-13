# -*- coding: utf-8 -*-
# Hinglish: Model-based narration — SQL + brief result ko readable English me summarise karta hai.

from __future__ import annotations
from typing import List, Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# Hinglish: lightweight cache
_model = None
_tok = None

def load_narrator(model_id: str, adapter_dir: str | None = None):
    global _model, _tok
    if _model is not None:
        return
    _tok = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    if _tok.pad_token is None:
        _tok.pad_token = _tok.eos_token
    _tok.padding_side = "left"

    base = AutoModelForCausalLM.from_pretrained(
        model_id, device_map="auto", trust_remote_code=True, load_in_4bit=True
    )
    if adapter_dir:
        from peft import PeftModel
        base = PeftModel.from_pretrained(base, adapter_dir)
    _model = base.eval()

def narrate(sql: str, rows: List[Dict[str, Any]], prompt_hint: str = "") -> str:
    if _model is None:
        return ""  # Hinglish: safe no-op if not loaded

    # Hinglish: trim rows to a few
    short = rows[:5]
    # Hinglish: simple prompt — English only, keep it crisp
    sys = "You are a concise ocean-data analyst. Write a 2-4 line English summary of the result below. Avoid slang. No code."
    user = f"Task hint: {prompt_hint}\nSQL:\n{sql}\nTop rows:\n{short}"
    text = f"[SYSTEM]\n{sys}\n\n[USER]\n{user}\n\n[ASSISTANT]\n"
    toks = _tok(text, return_tensors="pt").to(_model.device)
    out = _model.generate(**toks, max_new_tokens=160, do_sample=False, temperature=0.1)
    resp = _tok.decode(out[0], skip_special_tokens=True)
    # Hinglish: cheap strip
    if "[ASSISTANT]" in resp:
        resp = resp.split("[ASSISTANT]")[-1].strip()
    return resp.strip()
