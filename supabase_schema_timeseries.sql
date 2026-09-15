-- 1. Historical Daily OHLCV Time-Series Table
CREATE TABLE IF NOT EXISTS public.equity_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp BIGINT NOT NULL,
    open NUMERIC(12, 2) NOT NULL,
    high NUMERIC(12, 2) NOT NULL,
    low NUMERIC(12, 2) NOT NULL,
    close NUMERIC(12, 2) NOT NULL,
    volume BIGINT NOT NULL,
    ema50 NUMERIC(12, 2),
    sma200 NUMERIC(12, 2),
    rsi NUMERIC(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_symbol_timestamp UNIQUE (symbol, timestamp)
);

-- Fast lookup index for charting queries
CREATE INDEX IF NOT EXISTS idx_prices_symbol_time ON public.equity_prices(symbol, timestamp DESC);

-- 2. Normalized Financial Statements Table
CREATE TABLE IF NOT EXISTS public.equity_financials (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    fiscal_year VARCHAR(10) NOT NULL,
    revenue NUMERIC(15, 2),          -- in millions / billions
    operating_income NUMERIC(15, 2),
    free_cash_flow NUMERIC(15, 2),
    net_income NUMERIC(15, 2),
    total_debt NUMERIC(15, 2),
    cash_and_equivalents NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_symbol_fiscal_year UNIQUE (symbol, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_financials_symbol ON public.equity_financials(symbol, fiscal_year DESC);
