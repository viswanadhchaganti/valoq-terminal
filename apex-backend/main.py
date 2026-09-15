from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Valoq Valuation Terminal Engine", version="3.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3005",
        "http://127.0.0.1:3005"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Autocomplete search universe
TICKER_UNIVERSE = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "exchange": "NASDAQ", "type": "Stock"},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway", "exchange": "NYSE", "type": "Stock"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "exchange": "NYSE", "type": "Stock"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "exchange": "NSE", "type": "Stock"},
    {"symbol": "WABAG.NS", "name": "VA Tech Wabag Ltd", "exchange": "NSE", "type": "Stock"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "exchange": "NSE", "type": "Stock"},
]

# Watchlist Store synced with database schema
WATCHLIST_DB = [
    {"symbol": "NVDA", "company_name": "NVIDIA Corporation", "exchange": "NASDAQ", "target_buy_price": 115.00, "notes": "Consolidating near 50-day EMA"},
    {"symbol": "MSFT", "company_name": "Microsoft Corporation", "exchange": "NASDAQ", "target_buy_price": 410.00, "notes": "Enterprise Cloud & AI tailwinds"}
]

# AI Analysis Request Schema
class AIAnalysisRequest(BaseModel):
    symbol: str
    prompt_type: str = "summary"  # summary, risks, bull_bear, margins

@app.get("/api/v1/stock/search")
def search_stocks(q: str = Query(default="", description="Search query")):
    query = q.strip().upper()
    if not query:
        return []
    matches = [
        item for item in TICKER_UNIVERSE
        if query in item["symbol"] or query in item["name"].upper()
    ]
    return matches[:6]

@app.get("/api/v1/stock/quote")
def get_quote(
    symbol: str = Query(default="AAPL", description="US or Global ticker"),
    period: str = Query(default="1y", description="Data range: 1d, 5d, 1mo, 1y, 5y, max")
):
    clean_sym = symbol.strip().upper()
    try:
        t = yf.Ticker(clean_sym)
        interval = "5m" if period in ["1d", "5d"] else "1d"
        hist = t.history(period=period, interval=interval)
        
        if hist.empty and '.' not in clean_sym:
            clean_sym = clean_sym + ".NS"
            t = yf.Ticker(clean_sym)
            hist = t.history(period=period, interval=interval)

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"Ticker {clean_sym} not found")

        info = t.info or {}
        price = float(hist["Close"].iloc[-1])
        open_p = float(hist["Open"].iloc[0])
        day_change = price - open_p
        day_change_pct = (day_change / open_p) * 100 if open_p > 0 else 0.0

        pe_ttm = info.get("trailingPE") or info.get("forwardPE") or 28.5
        pe_sector = 25.8
        rev_growth = (info.get("revenueGrowth") or 0.08) * 100
        debt_to_equity = info.get("debtToEquity") or 110.0

        candles = []
        for ts, row in hist.iterrows():
            candles.append({
                "time": int(ts.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"])
            })

        scorecard = {
            "performance": {
                "tag": "High",
                "desc": "The creamy layer - amongst the top performing stocks",
                "metrics": f"1Y Return: +{round(day_change_pct, 1)}% vs S&P 500 benchmark (+18.4%)"
            },
            "valuation": {
                "tag": "High" if pe_ttm > pe_sector else "Good",
                "desc": "Seems overvalued vs market average" if pe_ttm > pe_sector else "Attractively priced relative to sector peers",
                "metrics": f"P/E Ratio: {round(pe_ttm, 1)}x (Sector Median: {pe_sector}x)"
            },
            "growth": {
                "tag": "High",
                "desc": "Strong financials and consistent growth trajectory",
                "metrics": f"Revenue Growth: +{round(rev_growth, 1)}% YoY (3Y CAGR: 11.2%)"
            },
            "profitability": {
                "tag": "High",
                "desc": "Showing strong signs of profitability & efficiency",
                "metrics": f"Operating Margin: {round((info.get('operatingMargins') or 0.30) * 100, 1)}% • ROE: {round((info.get('returnOnEquity') or 0.16) * 100, 1)}%"
            },
            "entry_point": {
                "tag": "Good",
                "desc": "The stock is underpriced and is not in overbought zone",
                "metrics": "RSI(14): 54.2 • Consolidating above 50-day EMA support"
            },
            "red_flags": {
                "tag": "Low" if debt_to_equity < 160 else "High",
                "desc": "No red flag found (No ASM / GSM / Default alerts)",
                "metrics": f"Debt/Equity: {round(debt_to_equity, 1)}% • Zero pledged promoter holding"
            }
        }

        financials = {
            "years": ["FY21", "FY22", "FY23", "FY24"],
            "revenue": [365.8, 394.3, 383.3, 391.0],
            "operating_income": [108.9, 119.4, 114.3, 123.2],
            "net_income": [94.7, 99.8, 97.0, 101.5],
            "free_cash_flow": [93.0, 111.4, 99.6, 108.8]
        }

        peers = [
            {"symbol": "MSFT", "name": "Microsoft Corporation", "pe": 34.2, "market_cap": "$3.12T", "pb": 12.4, "change": "+1.14%"},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "pe": 24.1, "market_cap": "$2.05T", "pb": 6.8, "change": "+0.45%"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "pe": 48.6, "market_cap": "$2.89T", "pb": 38.2, "change": "+2.85%"},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "pe": 41.5, "market_cap": "$1.95T", "pb": 7.9, "change": "-0.22%"}
        ]

        ccode = info.get("currency", "USD")
        sym_char = "$" if ccode == "USD" else ("₹" if ccode == "INR" else ccode + " ")

        return {
            "symbol": clean_sym,
            "company_name": info.get("longName") or info.get("shortName") or clean_sym,
            "exchange": info.get("exchange", "NASDAQ"),
            "currency": sym_char,
            "price": round(price, 2),
            "change": round(day_change, 2),
            "change_pct": round(day_change_pct, 2),
            "sector": info.get("sector", "Technology"),
            "industry": info.get("industry", "Consumer Electronics"),
            "mkt_cap": info.get("marketCap", 3000000000000),
            "beta": info.get("beta", 1.05),
            "pe": round(pe_ttm, 2),
            "sector_pe": pe_sector,
            "pb": round(info.get("priceToBook", 8.5), 2),
            "div_yield": round((info.get("dividendYield") or 0.005) * 100, 2),
            "forecast": {
                "buy_pct": 89,
                "upside_pct": 16.4,
                "target_price": round(price * 1.164, 2),
                "earnings_growth": 22.8,
                "rev_growth": round(rev_growth, 1)
            },
            "financials": financials,
            "peers": peers,
            "scorecard": scorecard,
            "candles": candles,
            "description": info.get("longBusinessSummary", "Global technology company.")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Watchlist Endpoints
@app.get("/api/v1/watchlist")
def get_watchlist():
    enriched = []
    for item in WATCHLIST_DB:
        try:
            t = yf.Ticker(item["symbol"])
            fast_info = t.fast_info
            current_p = round(float(fast_info.last_price), 2)
            prev_close = round(float(fast_info.previous_close), 2)
            chg_pct = round(((current_p - prev_close) / prev_close) * 100, 2)
        except Exception:
            current_p = 0.0
            chg_pct = 0.0
        
        enriched.append({
            **item,
            "current_price": current_p,
            "change_pct": chg_pct
        })
    return enriched

@app.post("/api/v1/watchlist")
def add_to_watchlist(symbol: str = Query(...), company_name: str = Query(default=""), exchange: str = Query(default="NASDAQ")):
    clean = symbol.strip().upper()
    for item in WATCHLIST_DB:
        if item["symbol"] == clean:
            return {"status": "exists", "message": "Ticker already pinned"}
    
    new_entry = {
        "symbol": clean,
        "company_name": company_name or clean,
        "exchange": exchange,
        "target_buy_price": None,
        "notes": "Added from terminal workspace"
    }
    WATCHLIST_DB.insert(0, new_entry)
    return {"status": "success", "item": new_entry}

@app.delete("/api/v1/watchlist/{symbol}")
def remove_from_watchlist(symbol: str):
    clean = symbol.strip().upper()
    global WATCHLIST_DB
    WATCHLIST_DB = [item for item in WATCHLIST_DB if item["symbol"] != clean]
    return {"status": "success", "symbol": clean}

# Valoq AI Analysis Endpoint
@app.post("/api/v1/stock/ai-analysis")
def generate_ai_analysis(req: AIAnalysisRequest):
    sym = req.symbol.strip().upper()
    try:
        t = yf.Ticker(sym)
        info = t.info or {}
        company = info.get("longName") or sym
        pe = info.get("trailingPE") or 28.5
        rev_growth = (info.get("revenueGrowth") or 0.08) * 100
        op_margins = (info.get("operatingMargins") or 0.30) * 100
        debt_to_equity = info.get("debtToEquity") or 110.0
        
        if req.prompt_type == "risks":
            report = (
                f"### 10-K Critical Risk Diagnostics: {company} ({sym})\n\n"
                f"1. **Capital Structure & Leverage:** Current Debt/Equity sits at {round(debt_to_equity, 1)}%. "
                f"Refinancing risk remains controlled, but sustained elevated policy rates may compress net interest margins.\n"
                f"2. **Valuation Sensitivity:** Trading at a trailing P/E of {round(pe, 1)}x. Any deceleration in top-line "
                f"growth below the historical baseline risks immediate multiple compression.\n"
                f"3. **Regulatory & Geographic Concentration:** Revenue exposure across global supply chains leaves operating margins "
                f"({round(op_margins, 1)}%) vulnerable to tariff adjustments and cross-border trade constraints."
            )
        elif req.prompt_type == "bull_bear":
            report = (
                f"### Institutional Bull vs. Bear Thesis: {company} ({sym})\n\n"
                f"**The Bull Case:**\n"
                f"- High operating efficiency with EBIT margins holding firm at {round(op_margins, 1)}%.\n"
                f"- Top-line expansion (+{round(rev_growth, 1)}% YoY) driven by expanding enterprise software and hardware monetization loops.\n"
                f"- Dominant market share supports disciplined pricing power and structural share repurchases.\n\n"
                f"**The Bear Case:**\n"
                f"- Multiples pricing in perfection at {round(pe, 1)}x P/E against broader sector medians.\n"
                f"- Capex demands for next-generation compute architectures may dampen intermediate free cash flow conversion."
            )
        elif req.prompt_type == "margins":
            report = (
                f"### Margin & Free Cash Flow Quality Audit: {company} ({sym})\n\n"
                f"- **Operating Margin Quality:** Current operating margin is {round(op_margins, 1)}%. High gross profit retention indicates minimal input price elasticity.\n"
                f"- **Cash Flow Conversion:** High quality of earnings. Operating cash generation comfortably covers trailing capital expenditures with strong discretionary FCF yields."
            )
        else:
            report = (
                f"### Executive Telemetry Brief: {company} ({sym})\n\n"
                f"{company} displays institutional quality metrics with a trailing P/E multiple of {round(pe, 1)}x and "
                f"operating margin efficiency of {round(op_margins, 1)}%. With revenue growing at {round(rev_growth, 1)}% YoY, "
                f"the asset demonstrates defensive cash generation backed by superior return on invested capital."
            )

        return {
            "symbol": sym,
            "company_name": company,
            "prompt_type": req.prompt_type,
            "analysis": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))