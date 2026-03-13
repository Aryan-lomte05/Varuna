# # apps/backend/src/llm/train_lora_sql_gen.py
# from __future__ import annotations

# import argparse
# from collections import Counter
# from typing import Dict, List, Any, Tuple

# import torch
# from datasets import load_dataset
# from transformers import (
#     AutoModelForCausalLM,
#     AutoTokenizer,
#     Trainer,
#     TrainingArguments,
#     DataCollatorForSeq2Seq,
# )
# from peft import LoraConfig, get_peft_model


# # ---------------------------
# # CLI
# # ---------------------------
# parser = argparse.ArgumentParser()
# parser.add_argument("--model", type=str, default="TinyLlama/TinyLlama-1.1B-Chat-v1.0")
# parser.add_argument("--train_file", type=str, required=True)
# parser.add_argument("--output_dir", type=str, required=True)

# # Accept multiple possible keys from your current data
# parser.add_argument(
#     "--question_keys",
#     type=str,
#     default="instruction,question,prompt,user,input",
#     help="Comma-separated candidate keys for the user/instruction side.",
# )
# parser.add_argument(
#     "--answer_keys",
#     type=str,
#     default="response,output,sql,answer,completion,text",
#     help="Comma-separated candidate keys for the target/completion side.",
# )

# args = parser.parse_args()
# QUESTION_KEYS = [k.strip() for k in args.question_keys.split(",") if k.strip()]
# ANSWER_KEYS = [k.strip() for k in args.answer_keys.split(",") if k.strip()]

# DEVICE_MAP = "auto"
# DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

# SYSTEM_STYLE = """You are FLOATCHATAI 🌊—a helpful, professional ocean-data analyst.
# - Always start with a short ocean-themed greeting (1 line, light humor ok).
# - Answer in clean Markdown with headings, bullets, and monospace for SQL.
# - If the user asks general questions (time, small math, pleasantries), answer directly and politely before returning to ocean tasks.
# - For data questions, propose a SQL first, then a concise explanation and a short result summary table if rows exist.
# - Be conservative—avoid hallucinations; if schema/columns are missing, say so and ask for clarification briefly.
# - Keep context from earlier messages in this conversation and use it to avoid repeating questions.
# """

# # ---------------------------
# # Load model/tokenizer
# # ---------------------------
# print(f"Loading base model… {args.model}")
# model = AutoModelForCausalLM.from_pretrained(
#     args.model,
#     torch_dtype=DTYPE,
#     device_map=DEVICE_MAP,
# )
# tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)

# # (1) Ensure tokenizer has a pad token (LLaMA-style models usually don't)
# if tokenizer.pad_token is None:
#     tokenizer.pad_token = tokenizer.eos_token
# # (1b) Consistent padding side for batching
# tokenizer.padding_side = "right"

# # (2) Ensure model knows its pad token
# if getattr(model.config, "pad_token_id", None) is None:
#     model.config.pad_token_id = tokenizer.pad_token_id

# # PEFT / LoRA
# lora_cfg = LoraConfig(
#     r=16,
#     lora_alpha=32,
#     lora_dropout=0.05,
#     bias="none",
#     task_type="CAUSAL_LM",
# )
# model = get_peft_model(model, lora_cfg)
# model.print_trainable_parameters()

# # ---------------------------
# # Load dataset
# # ---------------------------
# print(f"Loading dataset… {args.train_file}")
# raw = load_dataset("json", data_files=args.train_file, split="train")

# # Quick peek to understand the payload
# key_counter = Counter()
# for i in range(min(50, len(raw))):
#     key_counter.update(raw[i].keys())
# print("[debug] top keys:", key_counter.most_common(12))

# # ---------------------------
# # Data utils
# # ---------------------------
# def _pick(d: Dict[str, Any], keys_csv: str) -> str:
#     keys = [k.strip() for k in keys_csv.split(",") if k.strip()]
#     for k in keys:
#         v = d.get(k)
#         if isinstance(v, str) and v.strip():
#             return v.strip()
#         if v is not None and not isinstance(v, (dict, list)):
#             s = str(v).strip()
#             if s:
#                 return s
#     return ""

# def _from_messages(ex: Dict[str, Any]) -> Tuple[str, str] | None:
#     """
#     Expects ex['messages'] = [{'role': 'system|user|assistant', 'content': '...'}, ...]
#     We take the last assistant message as the training target (supervised signal),
#     everything before it forms the prompt.
#     """
#     msgs = ex.get("messages")
#     if not isinstance(msgs, list) or not msgs:
#         return None

#     last_ass_idx = None
#     for i in range(len(msgs) - 1, -1, -1):
#         m = msgs[i]
#         if isinstance(m, dict) and (m.get("role") or "").lower() == "assistant":
#             content = (m.get("content") or "").strip()
#             if content:
#                 last_ass_idx = i
#                 break
#     if last_ass_idx is None:
#         return None

#     parts: List[str] = []
#     for m in msgs[:last_ass_idx]:
#         role = (m.get("role") or "").strip().lower()
#         content = (m.get("content") or "").strip()
#         if not content:
#             continue
#         if role == "system":
#             parts.append(f"[SYSTEM]\n{content}")
#         elif role == "user":
#             parts.append(f"[USER]\n{content}")
#         elif role == "assistant":
#             parts.append(f"[ASSISTANT]\n{content}")
#         else:
#             parts.append(f"[{role.upper() or 'USER'}]\n{content}")

#     prompt = "\n\n".join(parts).strip()
#     target = msgs[last_ass_idx]["content"].strip()
#     if not prompt:
#         prompt = "Respond to the user based on prior marine data context."
#     return prompt, target

# def pack(ex: Dict[str, Any]) -> Dict[str, Any]:
#     # 1) Chat format?
#     got = _from_messages(ex)
#     if got:
#         q, a = got
#     else:
#         # 2) Key-based fallback (instruction/response-style)
#         q = _pick(ex, args.question_keys)
#         a = _pick(ex, args.answer_keys)
#         # 2b) SQL-only fallback
#         if not q and isinstance(ex.get("sql"), str) and ex["sql"].strip():
#             q = "Generate a PostgreSQL query for this oceanographic task."
#             a = ex["sql"].strip()

#     if not q or not a:
#         return {}

#     # Simple supervised causal LM: prompt + target in one sequence.
#     text = f"{q}\n\n[ASSISTANT]\n{a}"

#     toks = tokenizer(
#         text,
#         truncation=True,
#         max_length=1024,
#         padding=False,              # (3) let the collator pad dynamically
#         return_attention_mask=True,
#     )
#     # Labels mirror input_ids; collator will pad and set -100 for pad positions
#     toks["labels"] = toks["input_ids"].copy()
#     return toks

# proc = raw.map(pack, remove_columns=raw.column_names)

# usable = sum(1 for e in proc if "input_ids" in e and e["input_ids"])
# print(f"[debug] usable examples: {usable} / {len(raw)}")
# if usable == 0:
#     raise RuntimeError(
#         "No usable examples after mapping. "
#         "Check your --question_keys/--answer_keys or the JSONL structure."
#     )

# # (3) Collator that pads inputs and labels; masks labels with -100 on pad
# data_collator = DataCollatorForSeq2Seq(
#     tokenizer=tokenizer,
#     model=model,
#     padding="longest",
#     label_pad_token_id=-100,
#     pad_to_multiple_of=8 if torch.cuda.is_available() else None,
# )

# # (4) Training args — keep tokenized columns; enable fp16 on CUDA
# training_args = TrainingArguments(
#     output_dir=args.output_dir,
#     num_train_epochs=1,
#     per_device_train_batch_size=2,
#     gradient_accumulation_steps=1,
#     learning_rate=1e-4,
#     fp16=torch.cuda.is_available(),
#     logging_steps=5,
#     save_strategy="no",
#     report_to=[],
#     remove_unused_columns=False,  # keep tokenized fields
# )

# trainer = Trainer(
#     model=model,
#     args=training_args,
#     train_dataset=proc,
#     data_collator=data_collator,
# )

# trainer.train()

# trainer.save_model(args.output_dir)
# tokenizer.save_pretrained(args.output_dir)
# print(f"Saved LoRA to {args.output_dir}")
# -*- coding: utf-8 -*-
# Hinglish: LoRA SFT trainer — messages ya instruction/response JSONL ko padhta hai,
# Hinglish: RTX 4060 8GB ke liye QLoRA options (4bit/8bit), bf16/fp16 flags, etc.

from __future__ import annotations

import argparse
from collections import Counter
from typing import Dict, List, Any, Tuple, Optional

import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# ---------------------------
# CLI
# ---------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-3B-Instruct")
parser.add_argument("--train_file", type=str, required=True)
parser.add_argument("--output_dir", type=str, required=True)

# Hinglish: LoRA + precision/quantization params (RTX 4060 friendly)
parser.add_argument("--lora_r", type=int, default=16)
parser.add_argument("--lora_alpha", type=int, default=32)
parser.add_argument("--lora_dropout", type=float, default=0.05)
parser.add_argument("--bf16", type=lambda x: str(x).lower() in ["1","true","yes"], default=False)
parser.add_argument("--fp16", type=lambda x: str(x).lower() in ["1","true","yes"], default=True)
parser.add_argument("--quantization", type=str, choices=["none","4bit","8bit"], default="4bit")

# Hinglish: training hyperparams
parser.add_argument("--per_device_train_batch_size", type=int, default=4)
parser.add_argument("--gradient_accumulation_steps", type=int, default=2)
parser.add_argument("--learning_rate", type=float, default=2e-4)
parser.add_argument("--num_train_epochs", type=int, default=3)
parser.add_argument("--max_seq_len", type=int, default=2048)

# Flexible keys — aapke data me variation ho sakta hai
parser.add_argument("--question_keys", type=str,
    default="instruction,question,prompt,user,input",
    help="Comma-separated candidate keys for the user/instruction side.",
)
parser.add_argument("--answer_keys", type=str,
    default="response,output,sql,answer,completion,text",
    help="Comma-separated candidate keys for the target/completion side.",
)

args = parser.parse_args()
QUESTION_KEYS = [k.strip() for k in args.question_keys.split(",") if k.strip()]
ANSWER_KEYS   = [k.strip() for k in args.answer_keys.split(",") if k.strip()]

DEVICE_MAP = "auto"
# Hinglish: dtype auto — bf16>fp16>fp32
if args.bf16 and torch.cuda.is_available():
    DTYPE = torch.bfloat16
elif args.fp16 and torch.cuda.is_available():
    DTYPE = torch.float16
else:
    DTYPE = torch.float32

# ---------------------------
# Tokenizer + model (QLoRA)
# ---------------------------
print(f"[trainer] Loading base model: {args.model}")
tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

quant_args = {}
if args.quantization in ("4bit", "8bit"):
    try:
        import bitsandbytes as _bnb  # noqa
    except Exception:
        print("[warn] bitsandbytes not found; proceeding without k-bit quantization")
    else:
        if args.quantization == "4bit":
            quant_args = dict(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16 if args.bf16 else torch.float16,
            )
        else:
            quant_args = dict(load_in_8bit=True)

model = AutoModelForCausalLM.from_pretrained(
    args.model,
    torch_dtype=DTYPE if args.quantization == "none" else None,
    device_map=DEVICE_MAP,
    trust_remote_code=True,
    **quant_args,
)

if args.quantization in ("4bit","8bit"):
    model = prepare_model_for_kbit_training(model)

if getattr(model.config, "pad_token_id", None) is None:
    model.config.pad_token_id = tokenizer.pad_token_id

lora_cfg = LoraConfig(
    r=args.lora_r,
    lora_alpha=args.lora_alpha,
    lora_dropout=args.lora_dropout,
    bias="none",
    task_type="CAUSAL_LM",
    # Hinglish: common proj layers cover ho jayein
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
)
model = get_peft_model(model, lora_cfg)
model.print_trainable_parameters()

# ---------------------------
# Dataset
# ---------------------------
print(f"[trainer] Loading dataset: {args.train_file}")
raw = load_dataset("json", data_files=args.train_file, split="train")

# Quick peek
counter = Counter()
for i in range(min(50, len(raw))):
    counter.update(raw[i].keys())
print("[debug] top keys:", counter.most_common(12))

# ---------------------------
# Packing utils
# ---------------------------
from typing import Optional

def _pick(d: Dict[str, Any], keys: List[str]) -> str:
    # Hinglish: non-empty string ya printable scalar utha lo
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if v is not None and not isinstance(v, (dict, list)):
            s = str(v).strip()
            if s:
                return s
    return ""

def _from_messages(ex: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    """
    Hinglish: ex['messages'] = [{role, content}, ...]
    - last assistant -> target
    - pehle ke msgs -> prompt (SYSTEM/USER/ASSISTANT tags)
    """
    msgs = ex.get("messages")
    if not isinstance(msgs, list) or not msgs:
        return None

    last_ass_idx = None
    for i in range(len(msgs)-1, -1, -1):
        m = msgs[i]
        if isinstance(m, dict) and (m.get("role") or "").lower() == "assistant":
            content = (m.get("content") or "").strip()
            if content:
                last_ass_idx = i
                break
    if last_ass_idx is None:
        return None

    parts: List[str] = []
    for m in msgs[:last_ass_idx]:
        role = (m.get("role") or "").strip().lower()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            parts.append(f"[SYSTEM]\n{content}")
        elif role == "user":
            parts.append(f"[USER]\n{content}")
        elif role == "assistant":
            parts.append(f"[ASSISTANT]\n{content}")
        else:
            parts.append(f"[{role.upper() or 'USER'}]\n{content}")

    prompt = "\n\n".join(parts).strip() or "Respond to the user based on prior marine data context."
    target = msgs[last_ass_idx]["content"].strip()
    return prompt, target

def pack(ex: Dict[str, Any]) -> Dict[str, Any]:
    got = _from_messages(ex)
    if got:
        q, a = got
    else:
        q = _pick(ex, QUESTION_KEYS)
        a = _pick(ex, ANSWER_KEYS)
        if not q and isinstance(ex.get("sql"), str) and ex["sql"].strip():
            q = "Generate a PostgreSQL query for this oceanographic task."
            a = ex["sql"].strip()
    if not q or not a:
        return {}

    text = f"{q}\n\n[ASSISTANT]\n{a}"
    toks = tokenizer(
        text,
        truncation=True,
        max_length=args.max_seq_len,
        padding=False,
        return_attention_mask=True,
    )
    toks["labels"] = toks["input_ids"].copy()
    return toks

proc = raw.map(pack, remove_columns=raw.column_names)

usable = sum(1 for e in proc if "input_ids" in e and e["input_ids"])
print(f"[debug] usable examples: {usable} / {len(raw)}")
if usable == 0:
    raise RuntimeError("No usable examples after mapping. Check your keys/JSONL structure.")

collator = DataCollatorForSeq2Seq(
    tokenizer=tokenizer,
    model=model,
    padding="longest",
    label_pad_token_id=-100,
    pad_to_multiple_of=8 if torch.cuda.is_available() else None,
)

targs = TrainingArguments(
    output_dir=args.output_dir,
    num_train_epochs=args.num_train_epochs,
    per_device_train_batch_size=args.per_device_train_batch_size,
    gradient_accumulation_steps=args.gradient_accumulation_steps,
    learning_rate=args.learning_rate,
    fp16=args.fp16,
    bf16=args.bf16,
    logging_steps=20,
    save_strategy="epoch",
    report_to=[],
    remove_unused_columns=False,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    optim="paged_adamw_8bit" if args.quantization in ("4bit","8bit") else "adamw_torch",
)

trainer = Trainer(
    model=model,
    args=targs,
    train_dataset=proc,
    data_collator=collator,
)

trainer.train()
trainer.save_model(args.output_dir)
tokenizer.save_pretrained(args.output_dir)
print(f"[trainer] Saved LoRA to {args.output_dir}")
