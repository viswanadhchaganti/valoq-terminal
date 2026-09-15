import React, { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function Home() {
  const [ticker, setTicker] = useState("WABAG.NS");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartContainerRef = useRef(null);

  const fetchStock = async (sym) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/stock/quote?symbol=${sym}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStock(ticker);
  }, [ticker]);

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "#ffffff" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderColor: "#e2e8f0" },
      timeScale: { borderColor: "#e2e8f0" }
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: "#00d09c",
      topColor: "rgba(0, 208, 156, 0.28)",
      bottomColor: "rgba(0, 208, 156, 0.02)",
      lineWidth: 2
    });
    areaSeries.setData(data.candles.map(c => ({ time: c.time, value: c.close })));

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return (
    <div style={{ background: "#f7f9fb", minHeight: "100vh", fontFamily: "sans-serif", color: "#1a202c" }}>
      <div style={{ background: "#fff", padding: "8px 24px", borderBottom: "1px solid #e2e8f0", fontSize: "0.76rem", display: "flex", gap: "20px" }}>
        <span><strong>NIFTY 50:</strong> 25,388.90 <span style={{ color: "#00d09c" }}>+0.42% ▲</span></span>
        <span><strong>SENSEX:</strong> 83,184.80 <span style={{ color: "#00d09c" }}>+0.38% ▲</span></span>
        <span><strong>GOLD:</strong> ₹73,450 <span style={{ color: "#00d09c" }}>+0.35% ▲</span></span>
      </div>

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search Stock across NSE, BSE, US... (e.g. WABAG, RELIANCE, TCS, DELL)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: "12px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
          />
          <button
            onClick={() => query.trim() && setTicker(query.trim())}
            style={{ background: "#00d09c", color: "#fff", border: "none", padding: "0 24px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
          >
            SEARCH
          </button>
        </div>

        {loading ? (
          <div>Loading analytical platform data...</div>
        ) : data && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px" }}>
            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700 }}>{data.company_name}</div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "6px" }}>{data.symbol} • {data.exchange}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800 }}>{data.currency}{data.price.toFixed(2)}</span>
                  <span style={{ color: data.change >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                    {data.change >= 0 ? "+" : ""}{data.change_pct}%
                  </span>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1rem" }}>{data.symbol.split(".")[0]} Stock Scorecard</h3>
                {Object.entries(data.scorecard).map(([k, v]) => (
                  <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ textTransform: "capitalize", fontSize: "0.85rem" }}>{k.replace("_", " ")}</strong>
                      <span style={{ background: "#e6fbf5", color: "#00d09c", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>{v.tag}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "3px" }}>{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 10px 0" }}>TradingView Real-Time Chart</h4>
                <div ref={chartContainerRef} style={{ width: "100%", height: "320px" }} />
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
                <h4 style={{ margin: "0 0 10px 0" }}>Analyst Ratings & Unlocked Forecasts</h4>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#00d09c" }}>{data.forecast.buy_pct}%</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>Analysts Suggest Buy</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>+{data.forecast.upside_pct}%</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>1Y Target ({data.currency}{data.forecast.target_price})</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>+{data.forecast.earnings_growth}%</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>Earnings Growth YoY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
