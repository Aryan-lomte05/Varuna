# src/tools/smalltalk.py
import datetime
import math
import re

def is_smalltalk(q: str) -> bool:
    ql = q.lower()
    return any(p in ql for p in ["how are you", "hello", "hi ", "hey ", "who are you"])

def is_time(q: str) -> bool:
    return "time" in q.lower()

def is_math(q: str) -> bool:
    return bool(re.search(r"[0-9][0-9\.\s\+\-\*\/\(\)]*[0-9\)]", q))

def answer_smalltalk(q: str) -> str:
    return "I’m feeling fin-tastic! Let’s dive into your data questions. 🐟"

def answer_time() -> str:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"The current system time is **{now}**."

def answer_math(q: str) -> str:
    expr = re.sub(r"[^0-9\.\+\-\*\/\(\)\s]", "", q)
    try:
        val = eval(expr, {"__builtins__": {}}, {"math": math})
        return f"Calculation: `{expr}` = **{val}**"
    except Exception:
        return "Hmm, that expression looks a bit choppy. Try a simpler math expression?"
