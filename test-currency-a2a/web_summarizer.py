# /web_summarizer.py
from __future__ import annotations
import re
from dataclasses import dataclass
from typing import List, Optional, Iterable
import math

import httpx
from trafilatura import extract as tf_extract

USER_AGENT = "A2A-URL-Summarizer/1.0 (+https://example.local)"

URL_RE = re.compile(
    r'\bhttps?://[^\s<>()"\'\]]+',
    re.IGNORECASE,
)

@dataclass
class Page:
    url: str
    title: Optional[str]
    text: str
    word_count: int

class LinkReader:
    def __init__(self, client: Optional[httpx.AsyncClient] = None) -> None:
        self._client = client or httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": USER_AGENT})

    async def fetch_and_extract(self, url: str) -> Page:
        # 1) Fetch HTML
        r = await self._client.get(url)
        r.raise_for_status()
        html = r.text

        # 2) Extract main content (Trafilatura handles boilerplate removal)
        # favor_precision=True -> less noise, higher precision
        text = tf_extract(html, url=url, favor_precision=True) or ""
        text = text.strip()
        # Title: Trafilatura returns only text; a simple fallback from HTML <title>
        title = None
        m = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip()

        words = len(re.findall(r"\w+", text))
        return Page(url=url, title=title, text=text, word_count=words)

def chunk_text(s: str, max_chars: int = 6000) -> List[str]:
    """Naive, stable chunker by sentence boundaries when possible."""
    s = s.strip()
    if len(s) <= max_chars:
        return [s]
    out: List[str] = []
    start = 0
    while start < len(s):
        end = min(start + max_chars, len(s))
        # try to end on a sentence boundary
        cut = s.rfind(".", start, end)
        if cut == -1 or cut - start < max_chars * 0.6:
            cut = end
        else:
            cut += 1
        out.append(s[start:cut].strip())
        start = cut
    return out

def find_url(text: str) -> Optional[str]:
    m = URL_RE.search(text)
    return m.group(0) if m else None
