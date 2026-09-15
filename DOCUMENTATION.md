# Valo Valuation Terminal — Institutional Documentation & User Guide

Valoq is a full-stack, institutional-grade equity analysis portal inspired by platforms like TickerTape and Koyfin. It pairs live market telemetry with technical charting, quantitative valuation modeling, portfolio risk stress-testing, and persistent PostgreSQL storage.

---

## 1. System Architecture

```
+-----------------------------------------------------------------------+
|                             FRONTEND                                   |
|     Next.js 14 • React • TradingView Lightweight Charts • jsPDFD         |
|               Hosted on Vercel: valoq-terminal.vercel.app                }
+-----------------------+-------------------------^------------------------+
                        | HTTPS (REST)             | State Hydration
                        v                         |
+--------------------------------------------+-----------------------------+
|                             BACKEND                                  |
|        FastAPI (Python 3.11) • SQLlchemy 2.0 • Pandas �i NumPy          |
|                 Hosted on Render: valoq-backend.onrender.com             |
+------------------------+-------------------------^------------------------+
                        | IPv4 Session Pooling     | Query Results
                        v                         |
+--------------------------------------------+-----------------------------+
|                             DATABASE                                |
|                Supabase PostgreSQL 15 + Supabase Auth                    |
|      mzbcvazvagesgymqzhdi.pooler.supabase.com:5432 (Frankfurt, EU)       |
+------------------------------------------------------------------------+
```

---

## 2. Feature Directory & Financial Analysis Rationale

### 2.1. Dynamic Investment Scorecard (TickerTape-Style Factor Check)
* **What it is:** A 6-factor diagnostic checklist evaluating:
  1. **Performance:** Trailing 1-Year return relative to the S&P 500 benchmark (+18.4%).
  2. **Valuation:** Trailing/Forward P/E comparison against sector median multiples.
  3. **Growth:** Top-line revenue trajectory and 3-year historical CAGR.
  4. **Profitability:** Operating Margin quality and Return on Equity (ROE).
  5. **Entry Point:** Momentum evaluation based on the 14-day Rsi and 50-day EM proximity.
  6. **Red Flags:** Solvency check verifying Debt-to-Equity thresholds and default alerts.
* **Why it matters in stock analysis:** Prevents "value traps" and emotional entries. Rather than reading raw 10-K tables, an investor can instantly gauge whether a company possesses competitive moats and margin defensibility.

---

### 2.2. Interactive Candlestick & Technical Indicator Engine
* **What it is:** A financial chart powered by TradingView Lightweight Charts featuring:
  * **50-Day Exponential Moving Average (EMA):** Gives higher weight to recent trading sessions to track intermediate trend velocity.
  * **200-Day Simple Moving Average (SMA):** The institutional dividing line between secular bull and bear trends.
  * **14-Day Relative Strength Index (RSi) Sub-Panel:** A momentum oscillator plotted on a separate synchronized canvas with strict 70 Overbought and 30 Oversold threshold bands.
* **Why it matters in stock analysis:** Fundamental valuation tells you *what* to buy; technical structure dictates *when* to buy. Identifying golden crosses (50 EMA crossing above 200 SMA) or oversold Rsi washouts (< 30) allows investors to time their entries with institutional support.

---

### 2.3. Discounted Cash Flow (DCF) Intrinsic Valuation Model
* **What it is:** A financial valuation model based on projecting Free Cash Flows (FCI) 5 years into the future, discounting them back to the present day using the Weighted Average Cost of Capital (WACC), and adding a perpetual terminal value:
  * **PV of 5Y FCF:** Sum( FCF_t / (1 + r)\t)
  * **Terminal Value:** (FCF_5 * (1 + g)) / (r - g)
  * **Intrinsic Fair Value Per Share:** Enterprise Value / Shares Outstanding
* **Why it matters in stock analysis:** Market prices reflect prevailing sentiment; intrinsic value reflects underlying cash generation. If a stock trades at $350 but yields an intrinsic value of $420, it offers an implied margin of safety (+20%).

---

### 2.4. Interactive CAPM & WACC Calculator
* **What it is:** A dedicated modal that calculates the required rate of return for equity and debt:
  * Cost of Equity (Ke) = Rf + Beta * ERP
  * WACC = (E/V * Ke) + (D/V * Kd * (1 - TaxRate))
* **Why it matters in stock analysis:** Eliminates guesswork when choosing a discount rate. If a company operates with higher market volatility (Beta > 1.3) in a high-rate regime, its discount rate expands, adjusting the DCF hurdle rate accordingly.

---

### 2.5. Two-Dimensional DCF Sensitivity Matrix Heatmap
* **What it is:** A dynamic 25-cell matrix cross-tabulating 5 variations of WACC against 5 variations of Perpetual Terminal Growth (g), color-coding implied upside/downside percentages relative to current market price.
* **Why it matters in stock analysis:** Institutional analysts avoid single-point estimates. If a company requires an aggressive terminal growth rate of 4.5% just to justify its current price, the investment thesis carries high execution risk. The matrix reveals the margin of error at a glance.

---

### 2.6. Pinned Watchlist with Supabase PostgreSQL Persistence
* **What it is:** A user-isolated watchlist synced to Supabase via connection poolers, supporting:
  * Persistent storage across sessions and devices.
  * Inline editing for custom Target Buy Prices and Research Thesis Notes.
  * Real-time price telemetry and daily percentage shifts.
* **Why it matters in stock analysis:** Acts as your execution journal. By annotating why you pinned an equity and pre-defining entry limits, you eliminate emotional execution during market drawdowns.

---

### 2.7. Side-by-Side Multi-Ticker Comparison Matrix
* **What it is:** A comparative matrix evaluating all pinned watchlist stocks side-by-side across market capitalization, P/E multiples, P/B ratios, Beta, Dividend Yields, and 1-Year Wall Street consensus forecasts.
*Why it matters in stock analysis:** Capital is finite. Benchmarking multiple candidates side-by-side reveals which ticker offers superior growth at a reasonable price (GARP) 

---

### 2.8. Portfolio Risk, Weighted Beta & 1-Year 95% VaR Stress-Tester
*What it is:** An interactive allocation engine that aggregates pinned watchlist assets into a portfolio and calculates:
- Weighted Beta: Measures market volatility sensitivity.
- 1-Year 95% Value-at-Risk (VaR): Projects the maximum expected statistical portfolio drawdown under normal distribution conditions.
- Weighted Dividend Yield & Blended Upside.
*Why it matters in stock analysis:** A portfolio of individual winners can still concentrate factor risk. This tool ensures you aren't unknowingly running an excessively high-beta portfolio vulnerable to macroeconomic shifts.

---

### 2.9. Dual Export Suite: Institutional CSV & PDF Tear Sheets
*What it is:**
- CSV Tear Sheet: Downloads raw valuation inputs, 5-year projected cash flows, and terminal value sums for Excel analysis.
- PDF Tear Sheet: Uses html2canvas and jsPDFd to compile a multi-section PDF research note complete with scorecards, DCF tables, and the sensitivity matrix.
*Why it matters in stock analysis:** Allows you to archive investment memos or share theses with investment partners.

---

### 2.10. Institutional Dark Mode & User Authentication
*What it is:**
- Theme Engine: High-contrast Bloomberg terminal dark mode and clean TickerTape light mode applied across the canvas and charts.
- Supabase Authentication: Provides isolated user sessions so private notes, watchlists, and model parameters belong solely to the authenticated user.

---


### 2.21. Search Navigation Action Trigger & Explicit Button
* **What it is:** High-contrast emerald action button (`#059669`) with an SVG magnifying lens adjacent to the global search input.
* **Why it matters:** Provides an accessible interface for mouse, mobile, and tablet interactions without relying strictly on hardware `Enter` keystrokes.

---
## 3. Database Schema

```sql
CREATE TABLE public.watchlist (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    exchange VARCHAR(20) DEFAULT 'NASDAQ',
    target_buy_price NUMERIC(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. Maintenance & Upgrade Procedure
Every time a new feature or refinement is introduced:
1. Document the mathematical/financial rationale in Section 2 of this file.
2. Update the architecture diagram in Section 1 if dependencies change.
2. Commit and push:
   git add DOCUMENTATION.md
   git commit -m "docs: sync terminal documentation with latest release"
   git push origin main
EOF


## 10. Production DNS & Edge Routing Topology

Valoq uses an isolated edge architecture to split frontend asset delivery from backend financial telemetry:

| Hostname | Type | Target / Value | Provider | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `valoq.co.uk` | **A** | `76.76.21.21` | Vercel Edge | Apex domain serving Next.js client bundles |
| `www.valoq.co.uk` | **CNAME** | `cname.vercel-dns.com` | Vercel Edge | Auto-redirects all `www` requests to apex |
| `api.valoq.co.uk` | **CNAME** | `valoq-backend.onrender.com` | Render | Dedicated sub-domain for FastAPI & SSE streams |

* **SSL/TLS Encryption:** Automated TLS 1.3 encryption certificates managed at edge with auto-renewal via Let's Encrypt / DigiCert.
* **CORS Policy:** FastAPI allows preflight and telemetry queries from `https://valoq.co.uk` and `https://www.valoq.co.uk`.
