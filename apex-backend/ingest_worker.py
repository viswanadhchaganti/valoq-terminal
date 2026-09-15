import os
import sys
import time
import numpy as np
import pandas as pd
import yfinance as yf
from supabase import create_client, Client

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")).strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY in environment.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET_UNIVERSE = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"]

def ingest_historical_ohlcv(symbol: str, period: str = "1y"):
    print(f"[{symbol}] Ingesting historical OHLCV data...")
    t = yf.Ticker(symbol)
    hist = t.history(period=period)
    if hist is None or hist.empty:
        print(f"[{symbol}] No historical candles retrieved.")
        return

    # Compute moving averages & RSI
    hist["EMA50"] = hist["Close"].ewm(span=50, adjust=False).mean()
    hist["SMA200"] = hist["Close"].rolling(window=200).mean()

    delta = hist["Close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    hist["RSI"] = 100 - (100 / (1 + rs))
    hist["RSI"] = hist["RSI"].fillna(50.0)

    rows_to_upsert = []
    for idx, row in hist.iterrows():
        rows_to_upsert.append({
            "symbol": symbol,
            "timestamp": int(idx.timestamp()),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]) if not np.isnan(row["Volume"]) else 0,
            "ema50": round(float(row["EMA50"]), 2) if not np.isnan(row["EMA50"]) else None,
            "sma200": round(float(row["SMA200"]), 2) if not np.isnan(row["SMA200"]) else None,
            "rsi": round(float(row["RSI"]), 2)
        })

    # Upsert in chunks of 100 to avoid payload caps
    chunk_size = 100
    for i in range(0, len(rows_to_upsert), chunk_size):
        chunk = rows_to_upsert[i:i + chunk_size]
        try:
            supabase.table("equity_prices").upsert(chunk, on_conflict="symbol,timestamp").execute()
        except Exception as e:
            print(f"[{symbol}] Upsert error: {e}")

    print(f"[{symbol}] Successfully synced {len(rows_to_upsert)} price bars to PostgreSQL.")

def ingest_financial_filings(symbol: str):
    print(f"[{symbol}] Ingesting fundamental statement rows...")
    t = yf.Ticker(symbol)
    try:
        fin = t.financials
        cf = t.cashflow
        if fin is None or fin.empty:
            return

        years = [col.strftime("%Y") for col in fin.columns[:5]]
        for y_idx, year in enumerate(years):
            col = fin.columns[y_idx]
            rev = float(fin.loc["Total Revenue", col]) / 1e9 if "Total Revenue" in fin.index else 0.0
            ebit = float(fin.loc["Operating Income", col]) / 1e9 if "Operating Income" in fin.index else 0.0
            net_inc = float(fin.loc["Net Income", col]) / 1e9 if "Net Income" in fin.index else 0.0
            
            fcf = 0.0
            if cf is not None and not cf.empty and col in cf.columns:
                fcf = float(cf.loc["Free Cash Flow", col]) / 1e9 if "Free Cash Flow" in cf.index else 0.0

            payload = {
                "symbol": symbol,
                "fiscal_year": str(year),
                "revenue": round(rev, 2),
                "operating_income": round(ebit, 2),
                "free_cash_flow": round(fcf, 2),
                "net_income": round(net_inc, 2)
            }
            supabase.table("equity_financials").upsert(payload, on_conflict="symbol,fiscal_year").execute()

        print(f"[{symbol}] Successfully populated annual statements.")
    except Exception as e:
        print(f"[{symbol}] Fundamentals ingestion note: {e}")

def run_sync():
    print("=== Starting Valoq Data Ingestion Worker ===")
    for sym in TARGET_UNIVERSE:
        try:
            ingest_historical_ohlcv(sym)
            ingest_financial_filings(sym)
            time.sleep(1)  # Rate pacing
        except Exception as err:
            print(f"Failed pipeline on {sym}: {err}")
    print("=== Valoq Ingestion Pipeline Completed Successfully ===")

if __name__ == "__main__":
    run_sync()
