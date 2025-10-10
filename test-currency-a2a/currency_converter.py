# /currency_converter.py
from __future__ import annotations
import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Optional

import httpx

# Money-safe arithmetic defaults
getcontext().prec = 28

FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"

@dataclass
class ConversionResult:
    amount: Decimal
    from_ccy: str
    to_ccy: str
    rate: Decimal
    date: str  # YYYY-MM-DD (Frankfurter returns an effective date)

class CurrencyConverter:
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client or httpx.AsyncClient(timeout=10)

    async def supported(self) -> set[str]:
        r = await self._client.get(f"{FRANKFURTER_BASE}/currencies")
        r.raise_for_status()
        data = r.json()
        return set(data.keys())

    async def convert(self, amount: Decimal, from_ccy: str, to_ccy: str, date: Optional[str] = None) -> ConversionResult:
        from_ccy = from_ccy.upper()
        to_ccy = to_ccy.upper()
        if from_ccy == to_ccy:
            return ConversionResult(amount.quantize(Decimal("0.01")), from_ccy, to_ccy, Decimal("1"), date or "")

        endpoint = f"{FRANKFURTER_BASE}/latest" if not date else f"{FRANKFURTER_BASE}/{date}"
        params = {"base": from_ccy, "symbols": to_ccy}
        r = await self._client.get(endpoint, params=params)
        r.raise_for_status()
        data = r.json()
        rate = Decimal(str(data["rates"][to_ccy]))
        eff_date = data.get("date", date or "")
        converted = (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return ConversionResult(converted, from_ccy, to_ccy, rate, eff_date)

# ------------ simple parser ------------
_CONVERT_PATTERNS = [
    # "convert 100 usd to eur" / "convert 100 usd in eur"
    re.compile(r"\bconvert\s+([0-9][0-9_,.\s]*)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?\b", re.I),
    # "100 usd to eur" (no 'convert' verb)
    re.compile(r"\b([0-9][0-9_,.\s]*)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?\b", re.I),
    # "usd 100 in eur"
    re.compile(r"\b([a-z]{3})\s*([0-9][0-9_,.\s]*)\s+(?:to|in)\s+([a-z]{3})(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?\b", re.I),
]

def _num_to_decimal(txt: str) -> Decimal:
    # strip spaces and thousands separators (both comma and underscore)
    cleaned = txt.replace(" ", "").replace("_", "").replace(",", "")
    return Decimal(cleaned)

def parse_conversion_query(text: str) -> Optional[tuple[Decimal, str, str, Optional[str]]]:
    for pat in _CONVERT_PATTERNS:
        m = pat.search(text)
        if m:
            g = list(m.groups())
            # normalize order for the third pattern
            if pat.pattern.startswith(r"\b([a-z]{3})"):
                from_ccy, amount_s, to_ccy, date = g
            else:
                amount_s, from_ccy, to_ccy, date = g
            return _num_to_decimal(amount_s), from_ccy.upper(), to_ccy.upper(), date
    return None
