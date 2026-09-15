import React, { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import ValoqLogo from "../components/ValoqLogo";

const API_BASE = "https://valoq-backend.onrender.com";

export default function Home() {
  const [ticker, setTicker] = useState("AAPL");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeframe, setTimeframe] = useState("1y");
  const [chartType, setChartType] = useState("candles");
  const [activeTab, setActiveTab] = useState("dcf");
  const [expandedFactor, setExpandedFactor] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Technical Overlays & Oscillators
  const [showEMA50, setShowEMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  // Watchlist State
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlistDrawer, setShowWatchlistDrawer] = useState(false);
  const [editingNotes, setEditingNotes] = useState({});
  const [editingTarget, setEditingTarget] = useState({});

  // AI Drawer State
  const [showAIDrawer, setShowAIDrawer] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [selectedPromptType, setSelectedPromptType] = useState("summary");

  // DCF Sliders State
  const [growthRate, setGrowthRate] = useState(12.0);
  const [discountRate, setDiscountRate] = useState(8.5);
  const [terminalGrowth, setTerminalGrowth] = useState(3.0);

  const mainChartContainerRef = useRef(null);
  const rsiChartContainerRef = useRef(null);
  const mainChartInstance = useRef(null);
  const rsiChartInstance = useRef(null);

  const fetchStock = async (sym, period) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/stock/quote?symbol=${sym}&period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to retrieve live telemetry from backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/watchlist`);
      if (res.ok) {
        const json = await res.json();
        setWatchlist(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveWatchlistEdits = async (sym) => {
    const payload = {};
    if (editingTarget[sym] !== undefined) payload.target_buy_price = parseFloat(editingTarget[sym]);
    if (editingNotes[sym] !== undefined) payload.notes = editingNotes[sym];

    try {
      await fetch(`${API_BASE}/api/v1/watchlist/${sym}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to persist edits to Supabase", e);
    }
  };

  const requestAIAnalysis = async (type = selectedPromptType) => {
    if (!data) return;
    setAiLoading(true);
    setSelectedPromptType(type);
    try {
      const res = await fetch(`${API_BASE}/api/v1/stock/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: data.symbol, prompt_type: type })
      });
      if (res.ok) {
        const json = await res.json();
        setAiResult(json.analysis);
      }
    } catch (err) {
      console.error(err);
      setAiResult("Telemetry pipeline failed to generate AI synthesis.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(ticker, timeframe);
    fetchWatchlist();
  }, [ticker, timeframe]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/stock/search?q=${query}`);
        if (res.ok) {
          const list = await res.json();
          setSuggestions(list);
          setShowDropdown(list.length > 0);
        }
      } catch (err) {
        console.error(err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Main Chart + RSI Sub-panel Synchronized Setup
  useEffect(() => {
    if (!data || !mainChartContainerRef.current || !data.candles || data.candles.length === 0) return;

    if (mainChartInstance.current) {
      mainChartInstance.current.remove();
      mainChartInstance.current = null;
    }
    if (rsiChartInstance.current) {
      rsiChartInstance.current.remove();
      rsiChartInstance.current = null;
    }
    mainChartContainerRef.current.innerHTML = "";
    if (rsiChartContainerRef.current) rsiChartContainerRef.current.innerHTML = "";

    const sortedCandles = [...data.candles]
      .filter((v, i, a) => a.findIndex(t => t.time === v.time) === i)
      .sort((a, b) => a.time - b.time);

    // Main Canvas
    const chart = createChart(mainChartContainerRef.current, {
      width: mainChartContainerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "#ffffff" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#f8fafc" }, horzLines: { color: "#f8fafc" } },
      rightPriceScale: { borderColor: "#e2e8f0" },
      timeScale: { 
        borderColor: "#e2e8f0",
        timeVisible: timeframe === "1d" || timeframe === "5d",
        visible: !showRSI
      }
    });
    mainChartInstance.current = chart;

    if (chartType === "area") {
      const areaSeries = chart.addAreaSeries({
        lineColor: "#00d09c",
        topColor: "rgba(0, 208, 156, 0.25)",
        bottomColor: "rgba(0, 208, 156, 0.01)",
        lineWidth: 2
      });
      areaSeries.setData(sortedCandles.map(c => ({ time: c.time, value: c.close })));
    } else {
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#00d09c",
        downColor: "#eb5757",
        borderUpColor: "#00d09c",
        borderDownColor: "#eb5757",
        wickUpColor: "#00d09c",
        wickDownColor: "#eb5757"
      });
      candleSeries.setData(sortedCandles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      })));
    }

    if (showEMA50) {
      const emaSeries = chart.addLineSeries({ color: "#2563eb", lineWidth: 2, title: "50 EMA" });
      emaSeries.setData(sortedCandles.filter(c => c.ema50 !== null).map(c => ({ time: c.time, value: c.ema50 })));
    }

    if (showSMA200) {
      const smaSeries = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2, title: "200 SMA" });
      smaSeries.setData(sortedCandles.filter(c => c.sma200 !== null).map(c => ({ time: c.time, value: c.sma200 })));
    }

    const volumeSeries = chart.addHistogramSeries({
      color: "#cbd5e1",
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.8, bottom: 0 }
    });
    volumeSeries.setData(sortedCandles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(0, 208, 156, 0.35)" : "rgba(235, 87, 87, 0.35)"
    })));

    // RSI Oscillator Panel
    if (showRSI && rsiChartContainerRef.current) {
      const rsiChart = createChart(rsiChartContainerRef.current, {
        width: rsiChartContainerRef.current.clientWidth,
        height: 120,
        layout: { background: { color: "#ffffff" }, textColor: "#64748b" },
        grid: { vertLines: { color: "#f8fafc" }, horzLines: { color: "#f8fafc" } },
        rightPriceScale: { borderColor: "#e2e8f0", scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { 
          borderColor: "#e2e8f0",
          timeVisible: timeframe === "1d" || timeframe === "5d"
        }
      });
      rsiChartInstance.current = rsiChart;

      const rsiSeries = rsiChart.addLineSeries({
        color: "#8b5cf6",
        lineWidth: 2,
        title: "RSI (14)"
      });
      rsiSeries.setData(sortedCandles.map(c => ({ time: c.time, value: c.rsi })));

      // Overbought 70 and Oversold 30 threshold reference bands
      const overboughtLine = rsiChart.addLineSeries({ color: "#ef4444", lineStyle: 2, lineWidth: 1 });
      const oversoldLine = rsiChart.addLineSeries({ color: "#10b981", lineStyle: 2, lineWidth: 1 });
      overboughtLine.setData(sortedCandles.map(c => ({ time: c.time, value: 70 })));
      oversoldLine.setData(sortedCandles.map(c => ({ time: c.time, value: 30 })));

      // Synchronize horizontal scrolling/zooming between charts
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
      });
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) chart.timeScale().setVisibleLogicalRange(range);
      });

      rsiChart.timeScale().fitContent();
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      const w = mainChartContainerRef.current ? mainChartContainerRef.current.clientWidth : 0;
      if (mainChartInstance.current && w) mainChartInstance.current.applyOptions({ width: w });
      if (rsiChartInstance.current && w) rsiChartInstance.current.applyOptions({ width: w });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (mainChartInstance.current) {
        mainChartInstance.current.remove();
        mainChartInstance.current = null;
      }
      if (rsiChartInstance.current) {
        rsiChartInstance.current.remove();
        rsiChartInstance.current = null;
      }
    };
  }, [data, chartType, showEMA50, showSMA200, showRSI]);

  const togglePinWatchlist = async () => {
    if (!data) return;
    const isPinned = watchlist.some(w => w.symbol === data.symbol);
    if (isPinned) {
      await fetch(`${API_BASE}/api/v1/watchlist/${data.symbol}`, { method: "DELETE" });
    } else {
      await fetch(`${API_BASE}/api/v1/watchlist?symbol=${data.symbol}&company_name=${encodeURIComponent(data.company_name)}&exchange=${data.exchange}`, { method: "POST" });
    }
    fetchWatchlist();
  };

  const selectStock = (sym) => {
    setTicker(sym);
    setQuery("");
    setShowDropdown(false);
  };

  const calculateDCF = () => {
    if (!data) return { fairValue: 0, marginOfSafety: 0, enterpriseValue: 0, pvFutureFCF: 0, pvTerminalValue: 0 };
    const baseFCF = 105.0;
    const g = growthRate / 100;
    const r = discountRate / 100;
    const tg = terminalGrowth / 100;
    const sharesOutstanding = 15.3;

    if (r <= tg) return { fairValue: 0, marginOfSafety: 0, enterpriseValue: 0, pvFutureFCF: 0, pvTerminalValue: 0 };

    let pvFutureFCF = 0;
    let currentFCF = baseFCF;
    for (let i = 1; i <= 5; i++) {
      currentFCF *= (1 + g);
      pvFutureFCF += currentFCF / Math.pow(1 + r, i);
    }

    const terminalValue = (currentFCF * (1 + tg)) / (r - tg);
    const pvTerminalValue = terminalValue / Math.pow(1 + r, 5);
    const enterpriseValue = pvFutureFCF + pvTerminalValue;
    const fairValue = (enterpriseValue * 1000) / (sharesOutstanding * 1000);
    const marginOfSafety = ((fairValue - data.price) / data.price) * 100;

    return {
      fairValue: Math.round(fairValue * 100) / 100,
      marginOfSafety: Math.round(marginOfSafety * 10) / 10,
      enterpriseValue: Math.round(enterpriseValue * 10) / 10,
      pvFutureFCF: Math.round(pvFutureFCF * 10) / 10,
      pvTerminalValue: Math.round(pvTerminalValue * 10) / 10
    };
  };

  const exportDCFModelCSV = () => {
    if (!data) return;
    const dcf = calculateDCF();
    const rows = [
      ["Valoq Valuation Terminal - DCF Intrinsic Model Tear Sheet"],
      ["Generated", new Date().toISOString()],
      ["Symbol", data.symbol],
      ["Company Name", data.company_name],
      ["Exchange", data.exchange],
      ["Current Price", data.price],
      [],
      ["Key DCF Assumptions", "Value"],
      ["5Y Projected Revenue/FCF Growth", `${growthRate}%`],
      ["Discount Rate (WACC)", `${discountRate}%`],
      ["Perpetual Terminal Growth Rate", `${terminalGrowth}%`],
      [],
      ["Valuation Output", "Amount"],
      ["Present Value of 5Y Cash Flows ($B)", `$${dcf.pvFutureFCF}B`],
      ["Present Value of Terminal Value ($B)", `$${dcf.pvTerminalValue}B`],
      ["Estimated Enterprise Value ($B)", `$${dcf.enterpriseValue}B`],
      ["Intrinsic Fair Value Per Share", `$${dcf.fairValue}`],
      ["Implied Upside / Downside", `${dcf.marginOfSafety}%`]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Valoq_DCF_${data.symbol}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dcfResult = calculateDCF();
  const isCurrentPinned = data && watchlist.some(w => w.symbol === data.symbol);

  return (
    <div style={{ background: "#f7f9fb", minHeight: "100vh", fontFamily: "sans-serif", color: "#1a202c" }}>
      <div style={{ background: "#fff", padding: "6px 24px", borderBottom: "1px solid #e2e8f0", fontSize: "0.74rem", display: "flex", gap: "20px", overflowX: "auto" }}>
        <span><strong>S&P 500:</strong> 5,626.02 <span style={{ color: "#00d09c" }}>+0.54% ▲</span></span>
        <span><strong>NASDAQ:</strong> 17,683.98 <span style={{ color: "#00d09c" }}>+0.65% ▲</span></span>
        <span><strong>DOW JONES:</strong> 41,393.78 <span style={{ color: "#00d09c" }}>+0.32% ▲</span></span>
        <span><strong>GOLD:</strong> $2,584.10 <span style={{ color: "#00d09c" }}>+0.95% ▲</span></span>
      </div>

      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
          <ValoqLogo />

          <div style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
            <input
              type="text"
              placeholder="Search US or Global Equities (e.g. AAPL, NVDA, TSLA)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                outline: "none"
              }}
            />

            {showDropdown && (
              <div style={{
                position: "absolute",
                top: "105%",
                left: 0,
                right: 0,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                zIndex: 50,
                overflow: "hidden"
              }}>
                {suggestions.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => selectStock(item.symbol)}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #f8fafc"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{item.symbol}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "8px" }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#475569" }}>
                      {item.exchange}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => {
                setShowAIDrawer(true);
                if (!aiResult) requestAIAnalysis("summary");
              }}
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "#00f5a0",
                border: "1px solid #334155",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              ✦ Valoq AI
            </button>

            <button
              onClick={() => setShowWatchlistDrawer(!showWatchlistDrawer)}
              style={{
                background: "#f1f5f9",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              ★ Watchlist ({watchlist.length})
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00d09c", boxShadow: "0 0 8px #00d09c" }} />
              <span>US OPEN</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {loading && !data ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            Loading market telemetry for <strong>{ticker}</strong>...
          </div>
        ) : errorMsg ? (
          <div style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "16px", borderRadius: "8px", textAlign: "center" }}>
            {errorMsg}
          </div>
        ) : data && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px" }}>
            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700 }}>{data.company_name}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "6px" }}>{data.symbol} • {data.exchange}</div>
                  </div>
                  <button
                    onClick={togglePinWatchlist}
                    style={{
                      background: isCurrentPinned ? "#e6fbf5" : "#f1f5f9",
                      color: isCurrentPinned ? "#00d09c" : "#64748b",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {isCurrentPinned ? "★ Pinned" : "+ Pin"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800 }}>{data.currency}{data.price.toFixed(2)}</span>
                  <span style={{ color: data.change >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                    {data.change >= 0 ? "+" : ""}{data.change_pct}%
                  </span>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1rem" }}>{data.symbol} Investment Scorecard</h3>
                {data.scorecard && Object.entries(data.scorecard).map(([k, v]) => (
                  <div
                    key={k}
                    onClick={() => setExpandedFactor(expandedFactor === k ? null : k)}
                    style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ textTransform: "capitalize", fontSize: "0.85rem" }}>{k.replace("_", " ")}</strong>
                      <span style={{
                        background: v.tag === "High" || v.tag === "Good" ? "#e6fbf5" : "#fff1f2",
                        color: v.tag === "High" || v.tag === "Good" ? "#00d09c" : "#e11d48",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700
                      }}>
                        {v.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "3px" }}>{v.desc}</div>
                    
                    {expandedFactor === k && (
                      <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "8px 10px", marginTop: "8px", fontSize: "0.72rem", color: "#0f172a", border: "1px solid #e2e8f0" }}>
                        <strong>Diagnostic Telemetry:</strong> {v.metrics}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["1d", "5d", "1mo", "1y", "5y", "max"].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        style={{
                          background: timeframe === tf ? "#0f172a" : "#f1f5f9",
                          color: timeframe === tf ? "#fff" : "#475569",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {tf.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={() => setShowEMA50(!showEMA50)}
                      style={{
                        background: showEMA50 ? "#dbeafe" : "#f1f5f9",
                        color: showEMA50 ? "#1d4ed8" : "#64748b",
                        border: showEMA50 ? "1px solid #93c5fd" : "1px solid transparent",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ● 50 EMA
                    </button>

                    <button
                      onClick={() => setShowSMA200(!showSMA200)}
                      style={{
                        background: showSMA200 ? "#fef3c7" : "#f1f5f9",
                        color: showSMA200 ? "#b45309" : "#64748b",
                        border: showSMA200 ? "1px solid #fde68a" : "1px solid transparent",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ● 200 SMA
                    </button>

                    <button
                      onClick={() => setShowRSI(!showRSI)}
                      style={{
                        background: showRSI ? "#ede9fe" : "#f1f5f9",
                        color: showRSI ? "#6d28d9" : "#64748b",
                        border: showRSI ? "1px solid #c4b5fd" : "1px solid transparent",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ● RSI (14)
                    </button>

                    <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
                      <button
                        onClick={() => setChartType("area")}
                        style={{
                          background: chartType === "area" ? "#ffffff" : "transparent",
                          color: chartType === "area" ? "#0f172a" : "#64748b",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Line
                      </button>
                      <button
                        onClick={() => setChartType("candles")}
                        style={{
                          background: chartType === "candles" ? "#ffffff" : "transparent",
                          color: chartType === "candles" ? "#00d09c" : "#64748b",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        📊 Candles
                      </button>
                    </div>
                  </div>
                </div>

                <div ref={mainChartContainerRef} style={{ width: "100%", height: "320px" }} />

                {showRSI && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                      <span>RSI(14) OSCILLATOR</span>
                      <span>
                        <span style={{ color: "#ef4444" }}>70 Overbought</span> • <span style={{ color: "#10b981" }}>30 Oversold</span>
                      </span>
                    </div>
                    <div ref={rsiChartContainerRef} style={{ width: "100%", height: "120px" }} />
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "24px" }}>
                    {[
                      { id: "dcf", label: "⚡ DCF Intrinsic Valuation" },
                      { id: "overview", label: "Overview & Forecasts" },
                      { id: "financials", label: "Income & Cash Flows" },
                      { id: "peers", label: "Sector Peers Comparison" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          background: "none",
                          border: "none",
                          borderBottom: activeTab === tab.id ? "2px solid #00d09c" : "2px solid transparent",
                          paddingBottom: "8px",
                          fontWeight: activeTab === tab.id ? 800 : 600,
                          color: activeTab === tab.id ? "#0f172a" : "#64748b",
                          fontSize: "0.85rem",
                          cursor: "pointer"
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "dcf" && (
                    <button
                      onClick={exportDCFModelCSV}
                      style={{
                        background: "#0f172a",
                        color: "#00f5a0",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      📥 Export CSV Tear Sheet
                    </button>
                  )}
                </div>

                {activeTab === "dcf" && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>VALOQ INTRINSIC FAIR VALUE</span>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>
                          ${dcfResult.fairValue}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: dcfResult.marginOfSafety >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700, marginTop: "4px" }}>
                          {dcfResult.marginOfSafety >= 0 ? `+${dcfResult.marginOfSafety}% Undervalued (Upside)` : `${dcfResult.marginOfSafety}% Overvalued (Downside)`}
                        </div>
                      </div>

                      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>CURRENT MARKET PRICE</span>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>
                          ${data.price.toFixed(2)}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
                          5-Year Free Cash Flow Projections
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                          <span><strong>Projected 5Y Revenue/FCF Growth:</strong> {growthRate}%</span>
                          <span style={{ color: "#64748b" }}>Range: 4% to 25%</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="25"
                          step="0.5"
                          value={growthRate}
                          onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
                          style={{ width: "100%", accentColor: "#00d09c", cursor: "pointer" }}
                        />
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                          <span><strong>Discount Rate (WACC):</strong> {discountRate}%</span>
                          <span style={{ color: "#64748b" }}>Cost of Equity & Capital</span>
                        </div>
                        <input
                          type="range"
                          min="6"
                          max="14"
                          step="0.25"
                          value={discountRate}
                          onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
                          style={{ width: "100%", accentColor: "#00d09c", cursor: "pointer" }}
                        />
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                          <span><strong>Perpetual Terminal Growth Rate:</strong> {terminalGrowth}%</span>
                          <span style={{ color: "#64748b" }}>Long-term GDP projection</span>
                        </div>
                        <input
                          type="range"
                          min="1.5"
                          max="5.0"
                          step="0.1"
                          value={terminalGrowth}
                          onChange={(e) => setTerminalGrowth(parseFloat(e.target.value))}
                          style={{ width: "100%", accentColor: "#00d09c", cursor: "pointer" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "overview" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
                      <div>
                        <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#00d09c" }}>{data.forecast?.buy_pct}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>Wall Street Consensus Buy</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>+{data.forecast?.upside_pct}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>1Y Target ({data.currency}{data.forecast?.target_price})</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>+{data.forecast?.earnings_growth}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>Projected EPS Growth</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>P/E RATIO</span>
                        <strong style={{ fontSize: "0.9rem" }}>{data.pe}x</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>P/B RATIO</span>
                        <strong style={{ fontSize: "0.9rem" }}>{data.pb}x</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>DIVIDEND YIELD</span>
                        <strong style={{ fontSize: "0.9rem" }}>{data.div_yield}%</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>BETA</span>
                        <strong style={{ fontSize: "0.9rem" }}>{data.beta}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "financials" && data.financials && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                          <th style={{ padding: "8px 0" }}>Financial Metric ($ Billions)</th>
                          {data.financials.years.map(y => (
                            <th key={y} style={{ textAlign: "right", padding: "8px 0" }}>{y}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "10px 0", fontWeight: 600 }}>Total Revenue</td>
                          {data.financials.revenue.map((v, i) => (
                            <td key={i} style={{ textAlign: "right", fontWeight: 700 }}>${v}B</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "10px 0", color: "#475569" }}>Operating Income (EBIT)</td>
                          {data.financials.operating_income.map((v, i) => (
                            <td key={i} style={{ textAlign: "right" }}>${v}B</td>
                          ))}
                        </tr>
                        <tr>
                          <td style={{ padding: "10px 0", color: "#00d09c", fontWeight: 600 }}>Free Cash Flow</td>
                          {data.financials.free_cash_flow.map((v, i) => (
                            <td key={i} style={{ textAlign: "right", color: "#00d09c", fontWeight: 700 }}>${v}B</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "peers" && data.peers && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                          <th style={{ padding: "8px 0" }}>Company</th>
                          <th style={{ textAlign: "right", padding: "8px 0" }}>P/E</th>
                          <th style={{ textAlign: "right", padding: "8px 0" }}>P/B</th>
                          <th style={{ textAlign: "right", padding: "8px 0" }}>Market Cap</th>
                          <th style={{ textAlign: "right", padding: "8px 0" }}>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.peers.map((peer) => (
                          <tr
                            key={peer.symbol}
                            onClick={() => selectStock(peer.symbol)}
                            style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                          >
                            <td style={{ padding: "10px 0" }}>
                              <strong style={{ color: "#0f172a" }}>{peer.symbol}</strong>
                              <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "6px" }}>{peer.name}</span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{peer.pe}x</td>
                            <td style={{ textAlign: "right" }}>{peer.pb}x</td>
                            <td style={{ textAlign: "right" }}>{peer.market_cap}</td>
                            <td style={{ textAlign: "right", color: peer.change.startsWith("+") ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                              {peer.change}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Persistent Watchlist Drawer with In-line PostgreSQL Editing */}
      {showWatchlistDrawer && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "400px",
          background: "#ffffff",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Pinned Watchlist</h3>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Synced with Supabase PostgreSQL</span>
            </div>
            <button
              onClick={() => setShowWatchlistDrawer(false)}
              style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
            {watchlist.length === 0 ? (
              <div style={{ color: "#94a3b8", textAlign: "center", marginTop: "40px", fontSize: "0.85rem" }}>
                No pinned equities. Click <strong>+ Pin</strong> on any stock to save it.
              </div>
            ) : (
              watchlist.map((item) => (
                <div
                  key={item.symbol}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "14px",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div onClick={() => { selectStock(item.symbol); setShowWatchlistDrawer(false); }} style={{ cursor: "pointer" }}>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{item.symbol}</strong>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>{item.company_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>${item.current_price || "—"}</div>
                      <div style={{ fontSize: "0.72rem", color: item.change_pct >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                        {item.change_pct >= 0 ? "+" : ""}{item.change_pct}%
                      </div>
                    </div>
                  </div>

                  {/* Target Buy Price Editable Input */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0" }}>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", width: "90px" }}>Target Buy ($):</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editingTarget[item.symbol] !== undefined ? editingTarget[item.symbol] : (item.target_buy_price || "")}
                      onChange={(e) => setEditingTarget({ ...editingTarget, [item.symbol]: e.target.value })}
                      onBlur={() => saveWatchlistEdits(item.symbol)}
                      style={{
                        flex: 1,
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1"
                      }}
                    />
                  </div>

                  {/* Notes Editable Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                    <input
                      type="text"
                      placeholder="Add research / entry thesis notes..."
                      value={editingNotes[item.symbol] !== undefined ? editingNotes[item.symbol] : (item.notes || "")}
                      onChange={(e) => setEditingNotes({ ...editingNotes, [item.symbol]: e.target.value })}
                      onBlur={() => saveWatchlistEdits(item.symbol)}
                      style={{
                        width: "100%",
                        fontSize: "0.74rem",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc"
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Valoq AI Drawer */}
      {showAIDrawer && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "440px",
          background: "#090d14",
          color: "#f8fafc",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.5)",
          zIndex: 110,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid #1e293b"
        }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#00f5a0" }}>✦</span> VALOQ AI CO-PILOT
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                Institutional Telemetry & 10-K Diagnostic Engine
              </div>
            </div>
            <button
              onClick={() => setShowAIDrawer(false)}
              style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: "14px 22px", borderBottom: "1px solid #1e293b", display: "flex", gap: "8px", overflowX: "auto" }}>
            {[
              { id: "summary", label: "Executive Brief" },
              { id: "risks", label: "10-K Risk Factors" },
              { id: "bull_bear", label: "Bull vs Bear" },
              { id: "margins", label: "Margin Audit" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => requestAIAnalysis(p.id)}
                style={{
                  background: selectedPromptType === p.id ? "#00d09c" : "#1e293b",
                  color: selectedPromptType === p.id ? "#090d14" : "#cbd5e1",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {aiLoading ? (
              <div style={{ color: "#94a3b8", textAlign: "center", marginTop: "60px" }}>
                <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#00f5a0" }} />
                <div style={{ marginTop: "12px", fontSize: "0.8rem" }}>Synthesizing balance sheet & filing telemetry...</div>
              </div>
            ) : (
              <div style={{ whiteSpace: "pre-line", color: "#e2e8f0" }}>
                {aiResult || "Select an analytical prompt chip above to generate insights."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
