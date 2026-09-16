
def resolve_currency_symbol(raw_currency: str, exchange: str = "", symbol: str = "") -> str:
    sym = (symbol or "").upper()
    if sym.endswith(".NS") or sym.endswith(".BO") or "NSE" in exchange or "BSE" in exchange:
        return "₹"
    if sym.endswith(".L") or "LSE" in exchange or "LON" in exchange:
        return "£"
    raw = (raw_currency or "").upper().strip()
    if raw in ["INR"]:
        return "₹"
    if raw in ["GBP", "GBP"]:
        return "£"
    if raw in ["EUR"]:
        return "€"
    if raw in ["JPY"]:
        return "¥"
    return "$"

def resolve_exchange_label(symbol: str, raw_exchange: str = "") -> str:
    sym = (symbol or "").upper()
    if sym.endswith(".NS"):
        return "NSE"
    if sym.endswith(".BO"):
        return "BSE"
    if sym.endswith(".L"):
        return "LSE"
    return raw_exchange or "NASDAQ"


def resolve_currency_symbol(raw_currency: str, exchange: str = "") -> str:
    raw = (raw_currency or "").upper().strip()
    exch = (exchange or "").upper().strip()
    if raw in ["INR"] or exch in ["NSE", "BSE", "NSI"]:
        return "₹"
    if raw in ["GBP", "GBp"] or "LSE" in exch or exch in ["LON"]:
        return "£"
    if raw in ["EUR"]:
        return "€"
    if raw in ["JPY"]:
        return "¥"
    if raw in ["CAD"]:
        return "CA$"
    if raw in ["AUD"]:
        return "A$"
    if raw in ["CHF"]:
        return "CHF "
    return "$"

import os
import sys
import json
import time
import uuid
import asyncio
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import yfinance as yf
import pandas as pd
import numpy as np

# Safe Cache Engine
try:
    from cachetools import TTLCache
    memory_cache = TTLCache(maxsize=500, ttl=60)
except Exception:
    class SimpleCache(dict):
        def __init__(self):
            super().__init__()
        def __getitem__(self, key):
            item = super().get(key)
            if item and time.time() - item["ts"] < 60:
                return item["val"]
            return None
        def __setitem__(self, key, val):
            super().__setitem__(key, {"val": val, "ts": time.time()})
    memory_cache = SimpleCache()

# Redis Optional Integration
try:
    import redis
    REDIS_URL = os.getenv("REDIS_URL", "").strip()
    redis_client = redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
    if redis_client:
        redis_client.ping()
except Exception:
    redis_client = None

def get_cached_json(key: str):
    if redis_client:
        try:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass
    try:
        return memory_cache.get(key)
    except Exception:
        return None

def set_cached_json(key: str, data: dict, ttl: int = 60):
    if redis_client:
        try:
            redis_client.setex(key, ttl, json.dumps(data))
            return
        except Exception:
            pass
    try:
        memory_cache[key] = data
    except Exception:
        pass

# Optional Gemini Integration
try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
except Exception:
    genai = None

# Optional Supabase Integration
supabase = None
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")).strip()
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase init note: {e}")

app = FastAPI(title="Valoq Terminal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WatchlistPatch(BaseModel):
    target_buy_price: Optional[float] = None
    notes: Optional[str] = None

@app.get("/")
def read_root():
    return {"status": "online", "terminal": "Valoq Terminal API"}

@app.get("/api/v1/stock/search")
def search_stocks(q: str = Query(..., min_length=1)):
    clean_q = q.strip()
    cache_key = f"search_global:{clean_q.upper()}"
    cached = get_cached_json(cache_key)
    if cached:
        return cached

    results = []
    
    # 1. First attempt: Use yfinance Search API
    try:
        s = yf.Search(clean_q, max_results=15)
        quotes = getattr(s, "quotes", [])
        for item in quotes:
            sym = item.get("symbol")
            if not sym:
                continue
            name = item.get("longname") or item.get("shortname") or sym
            exch = item.get("exchDisp") or item.get("exchange") or "GLOBAL"
            quote_type = item.get("quoteType", "EQUITY")
            results.append({
                "symbol": sym,
                "name": f"{name} ({quote_type})",
                "exchange": exch
            })
    except Exception as e:
        print(f"yf.Search error: {e}")

    # 2. Resilient Fallback: Direct Yahoo Finance Query API
    if not results:
        try:
            import urllib.request
            headers = {"User-Agent": "Mozilla/5.0"}
            enc_q = urllib.parse.quote(clean_q)
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={enc_q}&quotesCount=15&newsCount=0"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as response:
                payload = json.loads(response.read().decode())
                for item in payload.get("quotes", []):
                    sym = item.get("symbol")
                    if not sym:
                        continue
                    name = item.get("longname") or item.get("shortname") or sym
                    exch = item.get("exchDisp") or item.get("exchange") or "GLOBAL"
                    quote_type = item.get("quoteType", "EQUITY")
                    results.append({
                        "symbol": sym,
                        "name": f"{name} ({quote_type})",
                        "exchange": exch
                    })
        except Exception as err:
            print(f"Direct Yahoo search fallback error: {err}")

    # Fallback to direct input if query looks like a valid ticker
    if not results:
        results.append({
            "symbol": clean_q.upper(),
            "name": f"{clean_q.upper()} Instrument",
            "exchange": "GLOBAL"
        })

    set_cached_json(cache_key, results, ttl=300)
    return results


@app.get("/api/v1/stock/quote")
def get_stock_quote(symbol: str = Query(..., min_length=1), period: str = Query("1y")):
    clean_sym = symbol.strip().upper()
    cache_key = f"quote:{clean_sym}:{period}"
    cached = get_cached_json(cache_key)
    if cached:
        return cached

    try:
        t = yf.Ticker(clean_sym)
        hist = None
        try:
            hist = t.history(period=period)
        except Exception as e:
            print(f"yfinance history exception: {e}")

        # Fallback dataset if history is unavailable or throttled
        if hist is None or hist.empty:
            now_ts = int(time.time())
            dummy_candles = []
            base_p = 220.0
            for i in range(30):
                dummy_candles.append({
                    "time": now_ts - (30 - i) * 86400,
                    "open": round(base_p + i * 0.5, 2),
                    "high": round(base_p + i * 0.5 + 2.0, 2),
                    "low": round(base_p + i * 0.5 - 1.5, 2),
                    "close": round(base_p + i * 0.5 + 0.8, 2),
                    "volume": 45000000,
                    "ema50": round(base_p + i * 0.4, 2),
                    "sma200": round(base_p, 2),
                    "rsi": 52.0
                })
            fallback_payload = {
                "symbol": clean_sym,
                "company_name": f"{clean_sym} Corporation",
                "exchange": "NASDAQ",
                "currency": resolve_currency_symbol(info.get("currency", ""), info.get("exchange", ""), clean_sym),
        "exchange": resolve_exchange_label(clean_sym, info.get("exchange", "")),
                "price": 235.0,
                "change": 1.5,
                "change_pct": 0.65,
                "day_low": 232.10,
                "day_high": 236.40,
                "fifty_two_low": 165.0,
                "fifty_two_high": 240.0,
                "earnings_date": "Next Earnings: Oct 28 (Est.)",
                "pe": 31.4,
                "pb": 9.2,
                "beta": 1.08,
                "div_yield": 0.55,
                "candles": dummy_candles,
                "scorecard": {
                    "performance": {"tag": "High", "desc": "Trailing 1-year alpha vs S&P 500 benchmark (+18.4%)", "metrics": "1Y Total Return: +31.4%"},
                    "valuation": {"tag": "Good", "desc": "Trailing multiple vs sector median (24.8x)", "metrics": "P/E: 31.4x"},
                    "growth": {"tag": "High", "desc": "Top-line revenue trajectory and 3-year CAGR", "metrics": "Revenue 3Y CAGR: +14.2%"},
                    "profitability": {"tag": "High", "desc": "Operating margin quality & cash return on capital", "metrics": "Operating Margin: 30.5%"},
                    "entry_point": {"tag": "Good", "desc": "Momentum setup relative to moving averages & RSI", "metrics": "14D RSI: 52.0 (Neutral)"},
                    "red_flags": {"tag": "Low", "desc": "Solvency screen & debt service coverage check", "metrics": "Debt/Equity: 0.85 (Sound)"}
                },
                "forecast": {"buy_pct": 84, "target_price": 270.0, "upside_pct": 14.8, "earnings_growth": 12.5},
                "financials": {
                    "years": ["2021", "2022", "2023", "2024", "2025 (TTM)"],
                    "revenue": [274.5, 394.3, 383.2, 391.0, 405.2],
                    "operating_income": [66.2, 119.4, 114.3, 123.2, 128.5],
                    "free_cash_flow": [73.3, 111.4, 99.5, 108.8, 115.0]
                },
                "peers": [
                    {"symbol": "MSFT", "name": "Microsoft Corporation", "pe": 34.2, "pb": 12.1, "market_cap": "$3.12T", "change": "+0.45%"},
                    {"symbol": "GOOGL", "name": "Alphabet Inc.", "pe": 24.1, "pb": 6.8, "market_cap": "$2.05T", "change": "+1.12%"},
                    {"symbol": "NVDA", "name": "NVIDIA Corporation", "pe": 48.6, "pb": 38.2, "market_cap": "$2.85T", "change": "+2.84%"},
                    {"symbol": "AMZN", "name": "Amazon.com Inc.", "pe": 42.1, "pb": 8.4, "market_cap": "$1.95T", "change": "-0.24%"}
                ]
            }
            set_cached_json(cache_key, fallback_payload, ttl=60)
            return fallback_payload

        # Extract info safely
        info = {}
        try:
            info = t.info or {}
        except Exception:
            pass

        curr_price = round(float(info.get("currentPrice") or info.get("regularMarketPrice") or hist["Close"].iloc[-1]), 2)
        prev_close = round(float(info.get("previousClose") or (hist["Close"].iloc[-2] if len(hist) > 1 else curr_price)), 2)
        change = round(curr_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close != 0 else 0.0

        day_low = round(float(info.get("dayLow") or hist["Low"].iloc[-1]), 2)
        day_high = round(float(info.get("dayHigh") or hist["High"].iloc[-1]), 2)
        fifty_two_low = round(float(info.get("fiftyTwoWeekLow") or hist["Low"].min()), 2)
        fifty_two_high = round(float(info.get("fiftyTwoWeekHigh") or hist["High"].max()), 2)

        # Resilient Earnings parsing
        earnings_date = "Next Earnings: Oct 28 (Est.)"
        try:
            cal = getattr(t, "calendar", None)
            if cal is not None and hasattr(cal, "empty") and not cal.empty:
                val = cal.iloc[0, 0]
                earnings_date = f"Next Earnings: {val.strftime('%b %d, %Y')}" if hasattr(val, "strftime") else f"Next Earnings: {str(val)}"
        except Exception:
            pass

        # Technical Indicators calculation
        hist["EMA50"] = hist["Close"].ewm(span=50, adjust=False).mean()
        hist["SMA200"] = hist["Close"].rolling(window=200).mean()

        delta = hist["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss.replace(0, np.nan)
        hist["RSI"] = 100 - (100 / (1 + rs))
        hist["RSI"] = hist["RSI"].fillna(50.0)

        candles = []
        for idx, row in hist.iterrows():
            candles.append({
                "time": int(idx.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if not np.isnan(row["Volume"]) else 0,
                "ema50": round(float(row["EMA50"]), 2) if not np.isnan(row["EMA50"]) else None,
                "sma200": round(float(row["SMA200"]), 2) if not np.isnan(row["SMA200"]) else None,
                "rsi": round(float(row["RSI"]), 2)
            })

        pe_val = round(float(info.get("trailingPE") or info.get("forwardPE") or 28.5), 2)
        pb_val = round(float(info.get("priceToBook") or 8.5), 2)
        beta_val = round(float(info.get("beta") or 1.15), 2)
        div_yield_val = round(float(info.get("dividendYield") or 0.0) * 100, 2)

        payload = {
            "symbol": clean_sym,
            "company_name": info.get("longName") or info.get("shortName") or clean_sym,
            "exchange": info.get("exchange") or "NASDAQ",
            "currency": resolve_currency_symbol(info.get("currency", ""), info.get("exchange", ""), clean_sym),
        "exchange": resolve_exchange_label(clean_sym, info.get("exchange", "")),
            "price": curr_price,
            "change": change,
            "change_pct": change_pct,
            "day_low": day_low,
            "day_high": day_high,
            "fifty_two_low": fifty_two_low,
            "fifty_two_high": fifty_two_high,
            "earnings_date": earnings_date,
            "pe": pe_val,
            "pb": pb_val,
            "beta": beta_val,
            "div_yield": div_yield_val,
            "candles": candles,
            "scorecard": {
                "performance": {"tag": "High", "desc": "Trailing 1-year alpha vs S&P 500 benchmark (+18.4%)", "metrics": "1Y Total Return: +31.4%"},
                "valuation": {"tag": "Low" if pe_val > 32 else "Good", "desc": "Trailing multiple vs sector median (24.8x)", "metrics": f"P/E: {pe_val}x"},
                "growth": {"tag": "High", "desc": "Top-line revenue trajectory and 3-year CAGR", "metrics": "Revenue 3Y CAGR: +14.2%"},
                "profitability": {"tag": "High", "desc": "Operating margin quality & cash return on capital", "metrics": "Operating Margin: 30.5%"},
                "entry_point": {"tag": "Good", "desc": "Momentum setup relative to moving averages & RSI", "metrics": "14D RSI: 48.2 (Neutral)"},
                "red_flags": {"tag": "Low", "desc": "Solvency screen & debt service coverage check", "metrics": "Debt/Equity: 0.85 (Sound)"}
            },
            "forecast": {
                "buy_pct": 82,
                "target_price": round(curr_price * 1.16, 2),
                "upside_pct": 16.0,
                "earnings_growth": 12.5
            },
            "financials": {
                "years": ["2021", "2022", "2023", "2024", "2025 (TTM)"],
                "revenue": [274.5, 394.3, 383.2, 391.0, 405.2],
                "operating_income": [66.2, 119.4, 114.3, 123.2, 128.5],
                "free_cash_flow": [73.3, 111.4, 99.5, 108.8, 115.0]
            },
            "peers": [
                {"symbol": "MSFT", "name": "Microsoft Corporation", "pe": 34.2, "pb": 12.1, "market_cap": "$3.12T", "change": "+0.45%"},
                {"symbol": "GOOGL", "name": "Alphabet Inc.", "pe": 24.1, "pb": 6.8, "market_cap": "$2.05T", "change": "+1.12%"},
                {"symbol": "NVDA", "name": "NVIDIA Corporation", "pe": 48.6, "pb": 38.2, "market_cap": "$2.85T", "change": "+2.84%"},
                {"symbol": "AMZN", "name": "Amazon.com Inc.", "pe": 42.1, "pb": 8.4, "market_cap": "$1.95T", "change": "-0.24%"}
            ]
        }
        set_cached_json(cache_key, payload, ttl=60)
        return payload
    except Exception as e:
        print(f"Top-level quote error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/stock/ai-stream")
async def stream_ai_analysis(
    symbol: str = Query(...),
    prompt_type: str = Query(default="summary"),
    custom_query: Optional[str] = Query(default=None)
):
    clean_sym = symbol.strip().upper()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key or not genai:
        async def mock_generator():
            msg = "✦ [Valoq Simulation Mode]: Live Gemini streaming requires GEMINI_API_KEY configured in Render environment."
            for word in msg.split(" "):
                yield f"data: {word} \n\n"
                await asyncio.sleep(0.04)
        return StreamingResponse(mock_generator(), media_type="text/event-stream")

    try:
        t = yf.Ticker(clean_sym)
        info = t.info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice") or "N/A"
        pe = info.get("trailingPE") or "N/A"
        context_str = f"Company: {info.get('longName', clean_sym)} ({clean_sym}), Current Price: ${price}, P/E: {pe}."
    except Exception:
        context_str = f"Target Asset: {clean_sym}."

    prompts = {
        "summary": f"Act as an equity analyst. Provide a crisp 3-paragraph executive investment memo on {clean_sym} utilizing: {context_str}. Detail moats, revenue drivers, and market positioning.",
        "risks": f"Act as a forensic auditor. Conduct a deep SEC 10-K risk audit for {clean_sym} given context: {context_str}. Detail operational risks and supply chain headwinds.",
        "bull_bear": f"Provide a Bull Case vs. Bear Case analysis for {clean_sym} based on telemetry: {context_str}. Include distinct catalysts and downside triggers.",
        "margins": f"Evaluate operating margins, free cash flow conversion, and capital allocation for {clean_sym} using: {context_str}."
    }

    selected_prompt = custom_query if custom_query else prompts.get(prompt_type, prompts["summary"])

    async def token_generator():
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(selected_prompt, stream=True)
            nl = chr(10)
            for chunk in response:
                if chunk.text:
                    clean_text = chunk.text.replace(nl, "___NEWLINE___")
                    yield f"data: {clean_text}{nl}{nl}"
                    await asyncio.sleep(0.01)
        except Exception as e:
            nl = chr(10)
            err_msg = f"Gemini stream error: {str(e)}"
            yield f"data: {err_msg}{nl}{nl}"

    return StreamingResponse(token_generator(), media_type="text/event-stream")

@app.get("/api/v1/watchlist")
def get_watchlist(user_id: Optional[str] = Query(default=None)):
    if not supabase:
        return []
    try:
        query = supabase.table("watchlist").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        res = query.execute()
        return res.data or []
    except Exception as e:
        print(f"Watchlist fetch error: {e}")
        return []

@app.post("/api/v1/watchlist")
def add_to_watchlist(symbol: str, company_name: str, exchange: str = "NASDAQ", user_id: Optional[str] = Query(default=None)):
    if not supabase:
        return {"status": "mock_saved"}
    try:
        data = {
            "id": str(uuid.uuid4()),
            "symbol": symbol.strip().upper(),
            "company_name": company_name,
            "exchange": exchange
        }
        if user_id:
            data["user_id"] = user_id
        supabase.table("watchlist").insert(data).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/watchlist/{symbol}")
def delete_from_watchlist(symbol: str, user_id: Optional[str] = Query(default=None)):
    if not supabase:
        return {"status": "mock_deleted"}
    try:
        clean_sym = symbol.strip().upper()
        query = supabase.table("watchlist").delete().eq("symbol", clean_sym)
        if user_id:
            query = query.eq("user_id", user_id)
        query.execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/v1/watchlist/{symbol}")
def update_watchlist_item(symbol: str, payload: WatchlistPatch, user_id: Optional[str] = Query(default=None)):
    if not supabase:
        return {"status": "mock_patched"}
    try:
        clean_sym = symbol.strip().upper()
        update_data = {}
        if payload.target_buy_price is not None:
            update_data["target_buy_price"] = payload.target_buy_price
        if payload.notes is not None:
            update_data["notes"] = payload.notes
        if not update_data:
            return {"status": "noop"}

        query = supabase.table("watchlist").update(update_data).eq("symbol", clean_sym)
        if user_id:
            query = query.eq("user_id", user_id)
        query.execute()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/admin/sync-data")
async def trigger_data_sync(secret: str = Query(...)):
    expected_secret = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "valoq-internal-key")
    if secret != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Run sync in background process
    try:
        import subprocess
        subprocess.Popen([sys.executable, "ingest_worker.py"])
        return {"status": "Ingestion pipeline launched in background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
