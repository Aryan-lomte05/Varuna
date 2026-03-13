# src/utils/pretty.py
from textwrap import dedent

OCEAN_GREETING = "🌊 Ahoy!"

def wrap_answer_md(body_markdown: str, title: str = "Result"):
    header = f"{OCEAN_GREETING} {title}\n"
    sep = "\n---\n"
    footer = "\n\n*— Sea you soon!* 🐬"
    return header + sep + body_markdown.strip() + footer
