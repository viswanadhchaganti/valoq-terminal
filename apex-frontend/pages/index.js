import React, { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import ValoqLogo from "../components/ValoqLogo";
import { supabase } from "../lib/supabaseClient";

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

  // Theme State (Dark / Light)
  const [darkMode, setDarkMode] = useState(false);

  // Technical Overlays & Oscillators
  const [showEMA50, setShowEMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  // Watchlist State & Comparison Matrix
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlistDrawer, setShowWatchlistDrawer] = useState(false);
  const [editingNotes, setEditingNotes] = useState({});
  const [editingTarget, setEditingTarget] = useState({});
  const [comparisonData, setComparisonData] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // AI Drawer State
  const [showAIDrawer, setShowAIDrawer] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [selectedPromptType, setSelectedPromptType] = useState("summary");

  // User Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // "signin" or "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatusMsg, setAuthStatusMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // DCF Sliders State
  const [growthRate, setGrowthRate] = useState(12.0);
  const [discountRate, setDiscountRate] = useState(8.5);
  const [terminalGrowth, setTerminalGrowth] = useState(3.0);

  // WACC Calculator Modal State
  const [showWaccModal, setShowWaccModal] = useState(false);
  const [riskFreeRate, setRiskFreeRate] = useState(4.25);
  const [equityRiskPremium, setEquityRiskPremium] = useState(5.0);
  const [costOfDebt, setCostOfDebt] = useState(5.2);
  const [taxRate, setTaxRate] = useState(21.0);
  const [equityWeight, setEquityWeight] = useState(85.0);

  const mainChartContainerRef = useRef(null);
  const rsiChartContainerRef = useRef(null);
  const mainChartInstance = useRef(null);
  const rsiChartInstance = useRef(null);

  // Color Tokens based on Theme
  const theme = {
    bg: darkMode ? "#0b0f19" : "#f7f9fb",
    cardBg: darkMode ? "#111827" : "#ffffff",
    cardSub: darkMode ? "#1a2234" : "#f8fafc",
    border: darkMode ? "#1f293d" : "#e2e8f0",
    text: darkMode ? "#f3f4f6" : "#0f172a",
    textSub: darkMode ? "#94a3b8" : "#64748b",
    chartBg: darkMode ? "#111827" : "#ffffff",
    gridLines: darkMode ? "#1a2234" : "#f8fafc",
    headerBg: darkMode ? "#0e1422" : "#ffffff"
  };

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
      const userParam = currentUser?.id ? `?user_id=${currentUser.id}` : "";
      const res = await fetch(`${API_BASE}/api/v1/watchlist${userParam}`);
      if (res.ok) {
        const json = await res.json();
        setWatchlist(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComparisonTelemetry = async () => {
    if (!watchlist || watchlist.length === 0) return;
    setComparisonLoading(true);
    try {
      const promises = watchlist.map(item =>
        fetch(`${API_BASE}/api/v1/stock/quote?symbol=${item.symbol}&period=1y`)
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
      );
      const results = await Promise.all(promises);
      setComparisonData(results.filter(Boolean));
    } catch (err) {
      console.error("Failed to load comparison batch", err);
    } finally {
      setComparisonLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "compare") {
      fetchComparisonTelemetry();
    }
  }, [activeTab, watchlist]);

  const saveWatchlistEdits = async (sym) => {
    const payload = {};
    if (editingTarget[sym] !== undefined) payload.target_buy_price = parseFloat(editingTarget[sym]);
    if (editingNotes[sym] !== undefined) payload.notes = editingNotes[sym];

    try {
      const userParam = currentUser?.id ? `?user_id=${currentUser.id}` : "";
      await fetch(`${API_BASE}/api/v1/watchlist/${sym}${userParam}`, {
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

  // Supabase Auth Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchStock(ticker, timeframe);
    fetchWatchlist();
  }, [ticker, timeframe, currentUser]);

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

  // Synchronized Multi-Chart Setup (Main + RSI) with Theme Reactive Sync
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

    // Primary Candlestick Canvas
    const chart = createChart(mainChartContainerRef.current, {
      width: mainChartContainerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: theme.chartBg }, textColor: theme.textSub },
      grid: { vertLines: { color: theme.gridLines }, horzLines: { color: theme.gridLines } },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { 
        borderColor: theme.border,
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
      const emaSeries = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2, title: "50 EMA" });
      emaSeries.setData(sortedCandles.filter(c => c.ema50 !== null).map(c => ({ time: c.time, value: c.ema50 })));
    }

    if (showSMA200) {
      const smaSeries = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2, title: "200 SMA" });
      smaSeries.setData(sortedCandles.filter(c => c.sma200 !== null).map(c => ({ time: c.time, value: c.sma200 })));
    }

    const volumeSeries = chart.addHistogramSeries({
      color: darkMode ? "#334155" : "#cbd5e1",
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.8, bottom: 0 }
    });
    volumeSeries.setData(sortedCandles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(0, 208, 156, 0.4)" : "rgba(235, 87, 87, 0.4)"
    })));

    // Synchronized RSI Oscillator Canvas
    if (showRSI && rsiChartContainerRef.current) {
      const rsiChart = createChart(rsiChartContainerRef.current, {
        width: rsiChartContainerRef.current.clientWidth,
        height: 120,
        layout: { background: { color: theme.chartBg }, textColor: theme.textSub },
        grid: { vertLines: { color: theme.gridLines }, horzLines: { color: theme.gridLines } },
        rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { 
          borderColor: theme.border,
          timeVisible: timeframe === "1d" || timeframe === "5d"
        }
      });
      rsiChartInstance.current = rsiChart;

      const rsiSeries = rsiChart.addLineSeries({
        color: "#a855f7",
        lineWidth: 2,
        title: "RSI (14)"
      });
      rsiSeries.setData(sortedCandles.map(c => ({ time: c.time, value: c.rsi })));

      const overboughtLine = rsiChart.addLineSeries({ color: "#ef4444", lineStyle: 2, lineWidth: 1 });
      const oversoldLine = rsiChart.addLineSeries({ color: "#10b981", lineStyle: 2, lineWidth: 1 });
      overboughtLine.setData(sortedCandles.map(c => ({ time: c.time, value: 70 })));
      oversoldLine.setData(sortedCandles.map(c => ({ time: c.time, value: 30 })));

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
  }, [data, chartType, showEMA50, showSMA200, showRSI, darkMode]);

  const togglePinWatchlist = async () => {
    if (!data) return;
    const isPinned = watchlist.some(w => w.symbol === data.symbol);
    if (isPinned) {
      const userParam = currentUser?.id ? `?user_id=${currentUser.id}` : "";
      await fetch(`${API_BASE}/api/v1/watchlist/${data.symbol}${userParam}`, { method: "DELETE" });
    } else {
      const userParam = currentUser?.id ? `&user_id=${currentUser.id}` : "";
      await fetch(`${API_BASE}/api/v1/watchlist?symbol=${data.symbol}&company_name=${encodeURIComponent(data.company_name)}&exchange=${data.exchange}${userParam}`, { method: "POST" });
    }
    fetchWatchlist();
  };

  const selectStock = (sym) => {
    setTicker(sym);
    setQuery("");
    setShowDropdown(false);
  };

  // CAPM & WACC Mathematical Calculation
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthStatusMsg("");
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthStatusMsg("Account created! Check your email to confirm registration.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthStatusMsg(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const calculateDerivedWACC = () => {
    const beta = data?.beta || 1.05;
    const costOfEquity = riskFreeRate + (beta * equityRiskPremium);
    const afterTaxCostOfDebt = costOfDebt * (1 - (taxRate / 100));
    const debtWeight = 100 - equityWeight;
    const derivedWacc = ((equityWeight / 100) * costOfEquity) + ((debtWeight / 100) * afterTaxCostOfDebt);
    return {
      costOfEquity: Math.round(costOfEquity * 100) / 100,
      afterTaxCostOfDebt: Math.round(afterTaxCostOfDebt * 100) / 100,
      wacc: Math.round(derivedWacc * 100) / 100
    };
  };

  const waccValues = calculateDerivedWACC();

  // DCF Intrinsic Formula
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

  
  // 2D DCF Sensitivity Matrix Generator
  const generateSensitivityMatrix = () => {
    if (!data) return { waccSteps: [], gSteps: [], matrix: [] };
    const baseFCF = 105.0;
    const g = growthRate / 100;
    const sharesOutstanding = 15.3;

    // Steps centered around current slider settings
    const waccSteps = [
      discountRate - 1.5,
      discountRate - 0.75,
      discountRate,
      discountRate + 0.75,
      discountRate + 1.5
    ].map(w => Math.round(w * 100) / 100);

    const gSteps = [
      terminalGrowth - 1.0,
      terminalGrowth - 0.5,
      terminalGrowth,
      terminalGrowth + 0.5,
      terminalGrowth + 1.0
    ].map(tg => Math.round(tg * 100) / 100);

    const matrix = waccSteps.map(waccVal => {
      const r = waccVal / 100;
      return gSteps.map(gVal => {
        const tg = gVal / 100;
        if (r <= tg) return { fairValue: 0, upside: -100 };

        let pvFutureFCF = 0;
        let currentFCF = baseFCF;
        for (let i = 1; i <= 5; i++) {
          currentFCF *= (1 + g);
          pvFutureFCF += currentFCF / Math.pow(1 + r, i);
        }

        const terminalValue = (currentFCF * (1 + tg)) / (r - tg);
        const pvTerminalValue = terminalValue / Math.pow(1 + r, 5);
        const enterpriseValue = pvFutureFCF + pvTerminalValue;
        const fairValue = Math.round(((enterpriseValue * 1000) / (sharesOutstanding * 1000)) * 100) / 100;
        const upside = Math.round(((fairValue - data.price) / data.price) * 1000) / 10;

        return { fairValue, upside, isCenter: waccVal === discountRate && gVal === terminalGrowth };
      });
    });

    return { waccSteps, gSteps, matrix };
  };

  const sensitivity = generateSensitivityMatrix();

  const dcfResult = calculateDCF();
  const isCurrentPinned = data && watchlist.some(w => w.symbol === data.symbol);

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", fontFamily: "sans-serif", color: theme.text, transition: "background 0.2s, color 0.2s" }}>
      {/* Global Macro Bar */}
      <div style={{ background: theme.cardBg, padding: "6px 24px", borderBottom: `1px solid ${theme.border}`, fontSize: "0.74rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "20px", overflowX: "auto" }}>
          <span><strong>S&P 500:</strong> 5,626.02 <span style={{ color: "#00d09c" }}>+0.54% ▲</span></span>
          <span><strong>NASDAQ:</strong> 17,683.98 <span style={{ color: "#00d09c" }}>+0.65% ▲</span></span>
          <span><strong>DOW JONES:</strong> 41,393.78 <span style={{ color: "#00d09c" }}>+0.32% ▲</span></span>
          <span><strong>GOLD:</strong> $2,584.10 <span style={{ color: "#00d09c" }}>+0.95% ▲</span></span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            background: darkMode ? "#1e293b" : "#f1f5f9",
            color: darkMode ? "#fbbf24" : "#475569",
            border: `1px solid ${theme.border}`,
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer"
          }}
        >
          {darkMode ? "☀ Light Mode" : "☾ Dark Terminal"}
        </button>
      </div>

      {/* Primary Navigation Header */}
      <header style={{ background: theme.headerBg, borderBottom: `1px solid ${theme.border}`, padding: "12px 24px" }}>
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
                border: `1px solid ${theme.border}`,
                background: darkMode ? "#1a2234" : "#ffffff",
                color: theme.text,
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
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
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
                      borderBottom: `1px solid ${theme.border}`
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = darkMode ? "#1f293d" : "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: theme.text }}>{item.symbol}</strong>
                      <span style={{ fontSize: "0.8rem", color: theme.textSub, marginLeft: "8px" }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, background: darkMode ? "#1f293d" : "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: theme.textSub }}>
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
                background: darkMode ? "#1f293d" : "#f1f5f9",
                color: theme.text,
                border: `1px solid ${theme.border}`,
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              ★ Watchlist ({watchlist.length})
            </button>

            {/* User Auth Button */}
            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.74rem", color: theme.textSub }}>
                  {currentUser.email.split("@")[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  style={{
                    background: "none",
                    border: `1px solid ${theme.border}`,
                    color: theme.textSub,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.7rem",
                    cursor: "pointer"
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowAuthModal(true); setAuthStatusMsg(""); }}
                style={{
                  background: "#00d09c",
                  color: "#090d14",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                Sign In
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", fontWeight: 600, color: theme.textSub }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00d09c", boxShadow: "0 0 8px #00d09c" }} />
              <span>US OPEN</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {loading && !data ? (
          <div style={{ padding: "60px", textAlign: "center", color: theme.textSub }}>
            Loading market telemetry for <strong>{ticker}</strong>...
          </div>
        ) : errorMsg ? (
          <div style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "16px", borderRadius: "8px", textAlign: "center" }}>
            {errorMsg}
          </div>
        ) : data && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px" }}>
            <div>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: theme.textSub, fontWeight: 700 }}>{data.company_name}</div>
                    <div style={{ fontSize: "0.72rem", color: theme.textSub, marginBottom: "6px" }}>{data.symbol} • {data.exchange}</div>
                  </div>
                  <button
                    onClick={togglePinWatchlist}
                    style={{
                      background: isCurrentPinned ? "rgba(0, 208, 156, 0.15)" : (darkMode ? "#1f293d" : "#f1f5f9"),
                      color: isCurrentPinned ? "#00d09c" : theme.textSub,
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
                  <span style={{ fontSize: "1.8rem", fontWeight: 800, color: theme.text }}>{data.currency}{data.price.toFixed(2)}</span>
                  <span style={{ color: data.change >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                    {data.change >= 0 ? "+" : ""}{data.change_pct}%
                  </span>
                </div>
              </div>

              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1rem", color: theme.text }}>{data.symbol} Investment Scorecard</h3>
                {data.scorecard && Object.entries(data.scorecard).map(([k, v]) => (
                  <div
                    key={k}
                    onClick={() => setExpandedFactor(expandedFactor === k ? null : k)}
                    style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ textTransform: "capitalize", fontSize: "0.85rem", color: theme.text }}>{k.replace("_", " ")}</strong>
                      <span style={{
                        background: v.tag === "High" || v.tag === "Good" ? "rgba(0, 208, 156, 0.15)" : "rgba(235, 87, 87, 0.15)",
                        color: v.tag === "High" || v.tag === "Good" ? "#00d09c" : "#eb5757",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700
                      }}>
                        {v.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: theme.textSub, marginTop: "3px" }}>{v.desc}</div>
                    
                    {expandedFactor === k && (
                      <div style={{ background: theme.cardSub, borderRadius: "6px", padding: "8px 10px", marginTop: "8px", fontSize: "0.72rem", color: theme.text, border: `1px solid ${theme.border}` }}>
                        <strong>Diagnostic Telemetry:</strong> {v.metrics}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              {/* Main Candlestick Panel */}
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["1d", "5d", "1mo", "1y", "5y", "max"].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        style={{
                          background: timeframe === tf ? "#00d09c" : (darkMode ? "#1f293d" : "#f1f5f9"),
                          color: timeframe === tf ? "#090d14" : theme.textSub,
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
                        background: showEMA50 ? "rgba(59, 130, 246, 0.2)" : (darkMode ? "#1f293d" : "#f1f5f9"),
                        color: showEMA50 ? "#3b82f6" : theme.textSub,
                        border: showEMA50 ? "1px solid #3b82f6" : "1px solid transparent",
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
                        background: showSMA200 ? "rgba(245, 158, 11, 0.2)" : (darkMode ? "#1f293d" : "#f1f5f9"),
                        color: showSMA200 ? "#f59e0b" : theme.textSub,
                        border: showSMA200 ? "1px solid #f59e0b" : "1px solid transparent",
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
                        background: showRSI ? "rgba(168, 85, 247, 0.2)" : (darkMode ? "#1f293d" : "#f1f5f9"),
                        color: showRSI ? "#a855f7" : theme.textSub,
                        border: showRSI ? "1px solid #a855f7" : "1px solid transparent",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ● RSI (14)
                    </button>

                    <div style={{ display: "flex", gap: "4px", background: darkMode ? "#1f293d" : "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
                      <button
                        onClick={() => setChartType("area")}
                        style={{
                          background: chartType === "area" ? (darkMode ? "#0f172a" : "#ffffff") : "transparent",
                          color: chartType === "area" ? theme.text : theme.textSub,
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
                          background: chartType === "candles" ? (darkMode ? "#0f172a" : "#ffffff") : "transparent",
                          color: chartType === "candles" ? "#00d09c" : theme.textSub,
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
                  <div style={{ marginTop: "12px", borderTop: `1px solid ${theme.border}`, paddingTop: "8px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textSub, marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                      <span>RSI(14) MOMENTUM OSCILLATOR</span>
                      <span>
                        <span style={{ color: "#ef4444" }}>70 Overbought</span> • <span style={{ color: "#10b981" }}>30 Oversold</span>
                      </span>
                    </div>
                    <div ref={rsiChartContainerRef} style={{ width: "100%", height: "120px" }} />
                  </div>
                )}
              </div>

              {/* Multi-Tab Analytics Workspace */}
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "20px" }}>
                    {[
                      { id: "dcf", label: "⚡ DCF Intrinsic Valuation" },
                      { id: "compare", label: "⚖ Side-by-Side Matrix" },
                      { id: "overview", label: "Overview & Forecasts" },
                      { id: "financials", label: "Income & Cash Flows" },
                      { id: "peers", label: "Sector Peers" }
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
                          color: activeTab === tab.id ? theme.text : theme.textSub,
                          fontSize: "0.85rem",
                          cursor: "pointer"
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "dcf" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setShowWaccModal(true)}
                        style={{
                          background: darkMode ? "#1e293b" : "#f1f5f9",
                          color: "#38bdf8",
                          border: `1px solid ${theme.border}`,
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        ⚙ Calculate WACC
                      </button>
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
                        📥 Export Tear Sheet
                      </button>
                    </div>
                  )}
                </div>

                {/* TAB 1: DCF INTRINSIC VALUATION */}
                {activeTab === "dcf" && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                      <div style={{ background: theme.cardSub, padding: "16px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                        <span style={{ fontSize: "0.75rem", color: theme.textSub, fontWeight: 700 }}>VALOQ INTRINSIC FAIR VALUE</span>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: theme.text, marginTop: "4px" }}>
                          ${dcfResult.fairValue}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: dcfResult.marginOfSafety >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700, marginTop: "4px" }}>
                          {dcfResult.marginOfSafety >= 0 ? `+${dcfResult.marginOfSafety}% Undervalued (Upside)` : `${dcfResult.marginOfSafety}% Overvalued (Downside)`}
                        </div>
                      </div>

                      <div style={{ background: theme.cardSub, padding: "16px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                        <span style={{ fontSize: "0.75rem", color: theme.textSub, fontWeight: 700 }}>CURRENT MARKET PRICE</span>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: theme.text, marginTop: "4px" }}>
                          ${data.price.toFixed(2)}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: theme.textSub, marginTop: "4px" }}>
                          5-Year Free Cash Flow Projections
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                          <span><strong>Projected 5Y Revenue/FCF Growth:</strong> {growthRate}%</span>
                          <span style={{ color: theme.textSub }}>Range: 4% to 25%</span>
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
                          <span style={{ color: theme.textSub }}>Cost of Equity & Capital</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="15"
                          step="0.1"
                          value={discountRate}
                          onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
                          style={{ width: "100%", accentColor: "#00d09c", cursor: "pointer" }}
                        />
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "6px" }}>
                          <span><strong>Perpetual Terminal Growth Rate:</strong> {terminalGrowth}%</span>
                          <span style={{ color: theme.textSub }}>Long-term GDP projection</span>
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

                    {/* 2D DCF Sensitivity Matrix Heatmap */}
                    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                          <strong style={{ fontSize: "0.9rem", color: theme.text }}>Two-Dimensional Valuation Sensitivity Matrix</strong>
                          <div style={{ fontSize: "0.72rem", color: theme.textSub }}>
                            Fair Value per share ($) cross-tabulated against Discount Rate (WACC) & Perpetual Growth Rate
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", fontWeight: 700 }}>
                          <span style={{ color: "#00d09c" }}>● Undervalued (Upside)</span>
                          <span style={{ color: "#eb5757" }}>● Overvalued (Downside)</span>
                        </div>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "0.76rem" }}>
                          <thead>
                            <tr>
                              <th style={{ padding: "8px", border: `1px solid ${theme.border}`, background: theme.cardSub, color: theme.textSub }}>
                                WACC \ Terminal g
                              </th>
                              {sensitivity.gSteps.map(gVal => (
                                <th
                                  key={gVal}
                                  style={{
                                    padding: "8px",
                                    border: `1px solid ${theme.border}`,
                                    background: gVal === terminalGrowth ? "rgba(56, 189, 248, 0.15)" : theme.cardSub,
                                    color: gVal === terminalGrowth ? "#38bdf8" : theme.text,
                                    fontWeight: gVal === terminalGrowth ? 800 : 600
                                  }}
                                >
                                  {gVal}%
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sensitivity.waccSteps.map((waccVal, rIdx) => (
                              <tr key={waccVal}>
                                <td
                                  style={{
                                    padding: "8px",
                                    border: `1px solid ${theme.border}`,
                                    background: waccVal === discountRate ? "rgba(56, 189, 248, 0.15)" : theme.cardSub,
                                    color: waccVal === discountRate ? "#38bdf8" : theme.text,
                                    fontWeight: waccVal === discountRate ? 800 : 600
                                  }}
                                >
                                  {waccVal}%
                                </td>
                                {sensitivity.matrix[rIdx].map((cell, cIdx) => {
                                  const isGreen = cell.upside >= 0;
                                  const absUpside = Math.min(Math.abs(cell.upside), 50);
                                  const alpha = 0.08 + (absUpside / 50) * 0.35;
                                  const cellBg = isGreen
                                    ? `rgba(0, 208, 156, ${alpha})`
                                    : `rgba(235, 87, 87, ${alpha})`;

                                  return (
                                    <td
                                      key={cIdx}
                                      style={{
                                        padding: "10px 6px",
                                        border: cell.isCenter ? "2px solid #38bdf8" : `1px solid ${theme.border}`,
                                        background: cellBg,
                                        fontWeight: cell.isCenter ? 900 : 700,
                                        color: isGreen ? (darkMode ? "#6ee7b7" : "#047857") : (darkMode ? "#fca5a5" : "#b91c1c")
                                      }}
                                    >
                                      <div>${cell.fairValue}</div>
                                      <div style={{ fontSize: "0.65rem", opacity: 0.85 }}>
                                        {cell.upside >= 0 ? "+" : ""}{cell.upside}%
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SIDE-BY-SIDE MULTI-TICKER COMPARISON */}
                {activeTab === "compare" && (
                  <div>
                    {comparisonLoading ? (
                      <div style={{ textAlign: "center", padding: "40px", color: theme.textSub }}>
                        Gathering real-time multi-ticker balance sheets & multiples...
                      </div>
                    ) : comparisonData.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px", color: theme.textSub }}>
                        No watchlist items to benchmark. Click <strong>+ Pin</strong> to add equities.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", textAlign: "left", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSub }}>
                              <th style={{ padding: "10px 8px" }}>Asset</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>Price</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>P/E Multiple</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>P/B Multiple</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>Beta</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>Div Yield</th>
                              <th style={{ padding: "10px 8px", textAlign: "right" }}>1Y Forecast</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparisonData.map((item) => (
                              <tr
                                key={item.symbol}
                                onClick={() => selectStock(item.symbol)}
                                style={{ borderBottom: `1px solid ${theme.border}`, cursor: "pointer" }}
                              >
                                <td style={{ padding: "12px 8px" }}>
                                  <strong style={{ color: theme.text }}>{item.symbol}</strong>
                                  <div style={{ fontSize: "0.72rem", color: theme.textSub }}>{item.company_name}</div>
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 700, color: theme.text }}>
                                  ${item.price}
                                </td>
                                <td style={{ textAlign: "right", color: item.pe > 35 ? "#eb5757" : "#00d09c", fontWeight: 700 }}>
                                  {item.pe}x
                                </td>
                                <td style={{ textAlign: "right", color: theme.text }}>
                                  {item.pb}x
                                </td>
                                <td style={{ textAlign: "right", color: theme.text }}>
                                  {item.beta}
                                </td>
                                <td style={{ textAlign: "right", color: theme.text }}>
                                  {item.div_yield}%
                                </td>
                                <td style={{ textAlign: "right", color: "#00d09c", fontWeight: 700 }}>
                                  +{item.forecast?.upside_pct}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: OVERVIEW & FORECASTS */}
                {activeTab === "overview" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
                      <div>
                        <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#00d09c" }}>{data.forecast?.buy_pct}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: theme.textSub }}>Wall Street Consensus Buy</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: theme.text }}>+{data.forecast?.upside_pct}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: theme.textSub }}>1Y Target ({data.currency}{data.forecast?.target_price})</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: theme.text }}>+{data.forecast?.earnings_growth}%</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: theme.textSub }}>Projected EPS Growth</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", background: theme.cardSub, padding: "12px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: theme.textSub, display: "block" }}>P/E RATIO</span>
                        <strong style={{ fontSize: "0.9rem", color: theme.text }}>{data.pe}x</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: theme.textSub, display: "block" }}>P/B RATIO</span>
                        <strong style={{ fontSize: "0.9rem", color: theme.text }}>{data.pb}x</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: theme.textSub, display: "block" }}>DIVIDEND YIELD</span>
                        <strong style={{ fontSize: "0.9rem", color: theme.text }}>{data.div_yield}%</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: theme.textSub, display: "block" }}>BETA</span>
                        <strong style={{ fontSize: "0.9rem", color: theme.text }}>{data.beta}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: FINANCIALS */}
                {activeTab === "financials" && data.financials && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSub }}>
                          <th style={{ padding: "8px 0" }}>Financial Metric ($ Billions)</th>
                          {data.financials.years.map(y => (
                            <th key={y} style={{ textAlign: "right", padding: "8px 0" }}>{y}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: "10px 0", fontWeight: 600, color: theme.text }}>Total Revenue</td>
                          {data.financials.revenue.map((v, i) => (
                            <td key={i} style={{ textAlign: "right", fontWeight: 700, color: theme.text }}>${v}B</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: "10px 0", color: theme.textSub }}>Operating Income (EBIT)</td>
                          {data.financials.operating_income.map((v, i) => (
                            <td key={i} style={{ textAlign: "right", color: theme.text }}>${v}B</td>
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

                {/* TAB 5: SECTOR PEERS */}
                {activeTab === "peers" && data.peers && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "left", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSub }}>
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
                            style={{ borderBottom: `1px solid ${theme.border}`, cursor: "pointer" }}
                          >
                            <td style={{ padding: "10px 0" }}>
                              <strong style={{ color: theme.text }}>{peer.symbol}</strong>
                              <span style={{ fontSize: "0.75rem", color: theme.textSub, marginLeft: "6px" }}>{peer.name}</span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600, color: theme.text }}>{peer.pe}x</td>
                            <td style={{ textAlign: "right", color: theme.text }}>{peer.pb}x</td>
                            <td style={{ textAlign: "right", color: theme.text }}>{peer.market_cap}</td>
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

      {/* Interactive WACC Calculator Modal */}
      {showWaccModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: "14px",
            width: "100%",
            maxWidth: "520px",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: theme.text }}>
                ⚙ Capital Asset Pricing Model (CAPM) & WACC
              </h3>
              <button
                onClick={() => setShowWaccModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: theme.textSub }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: theme.cardSub, padding: "14px", borderRadius: "10px", border: `1px solid ${theme.border}`, marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: theme.textSub, fontWeight: 700 }}>DERIVED DISCOUNT RATE (WACC)</span>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#38bdf8", marginTop: "2px" }}>
                  {waccValues.wacc}%
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.75rem", color: theme.textSub }}>
                <div>Cost of Equity: <strong style={{ color: theme.text }}>{waccValues.costOfEquity}%</strong></div>
                <div>After-Tax Cost of Debt: <strong style={{ color: theme.text }}>{waccValues.afterTaxCostOfDebt}%</strong></div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.8rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Risk-Free Rate (10Y US Treasury):</span>
                  <strong>{riskFreeRate}%</strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="0.05"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Equity Risk Premium (ERP):</span>
                  <strong>{equityRiskPremium}%</strong>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  step="0.1"
                  value={equityRiskPremium}
                  onChange={(e) => setEquityRiskPremium(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Pre-Tax Cost of Debt:</span>
                  <strong>{costOfDebt}%</strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="9"
                  step="0.1"
                  value={costOfDebt}
                  onChange={(e) => setCostOfDebt(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Equity Weight in Capital Structure:</span>
                  <strong>{equityWeight}% (Debt: {100 - equityWeight}%)</strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="1"
                  value={equityWeight}
                  onChange={(e) => setEquityWeight(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => {
                  setDiscountRate(waccValues.wacc);
                  setShowWaccModal(false);
                }}
                style={{
                  flex: 1,
                  background: "#00d09c",
                  color: "#090d14",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                Apply {waccValues.wacc}% to DCF Model
              </button>
              <button
                onClick={() => setShowWaccModal(false)}
                style={{
                  background: darkMode ? "#1f293d" : "#f1f5f9",
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Watchlist Drawer */}
      {showWatchlistDrawer && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "400px",
          background: theme.cardBg,
          boxShadow: "-8px 0 24px rgba(0,0,0,0.3)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${theme.border}`
        }}>
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: theme.text }}>Pinned Watchlist</h3>
              <span style={{ fontSize: "0.7rem", color: theme.textSub }}>Synced with Supabase PostgreSQL</span>
            </div>
            <button
              onClick={() => setShowWatchlistDrawer(false)}
              style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: theme.textSub }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
            {watchlist.length === 0 ? (
              <div style={{ color: theme.textSub, textAlign: "center", marginTop: "40px", fontSize: "0.85rem" }}>
                No pinned equities. Click <strong>+ Pin</strong> on any stock to save it.
              </div>
            ) : (
              watchlist.map((item) => (
                <div
                  key={item.symbol}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: `1px solid ${theme.border}`,
                    marginBottom: "14px",
                    background: theme.cardBg
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div onClick={() => { selectStock(item.symbol); setShowWatchlistDrawer(false); }} style={{ cursor: "pointer" }}>
                      <strong style={{ fontSize: "0.95rem", color: theme.text }}>{item.symbol}</strong>
                      <div style={{ fontSize: "0.74rem", color: theme.textSub }}>{item.company_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: theme.text }}>${item.current_price || "—"}</div>
                      <div style={{ fontSize: "0.72rem", color: item.change_pct >= 0 ? "#00d09c" : "#eb5757", fontWeight: 700 }}>
                        {item.change_pct >= 0 ? "+" : ""}{item.change_pct}%
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0" }}>
                    <span style={{ fontSize: "0.72rem", color: theme.textSub, width: "90px" }}>Target Buy ($):</span>
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
                        border: `1px solid ${theme.border}`,
                        background: darkMode ? "#1a2234" : "#ffffff",
                        color: theme.text
                      }}
                    />
                  </div>

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
                        border: `1px solid ${theme.border}`,
                        background: darkMode ? "#1a2234" : "#f8fafc",
                        color: theme.text
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
      {/* Supabase User Authentication Modal */}
      {showAuthModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: "14px",
            width: "100%",
            maxWidth: "400px",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: theme.text }}>
                {authMode === "signin" ? "Sign In to Valoq" : "Create Valoq Account"}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: theme.textSub }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: theme.textSub, display: "block", marginBottom: "4px" }}>Email</label>
                <input
                  type="email"
                  required
                  placeholder="analyst@firm.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    background: darkMode ? "#1a2234" : "#ffffff",
                    color: theme.text,
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: theme.textSub, display: "block", marginBottom: "4px" }}>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    background: darkMode ? "#1a2234" : "#ffffff",
                    color: theme.text,
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>

              {authStatusMsg && (
                <div style={{ fontSize: "0.75rem", color: authStatusMsg.includes("Check") ? "#00d09c" : "#eb5757", marginTop: "4px" }}>
                  {authStatusMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  background: "#00d09c",
                  color: "#090d14",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: authLoading ? "not-allowed" : "pointer",
                  marginTop: "8px"
                }}
              >
                {authLoading ? "Authenticating..." : (authMode === "signin" ? "Sign In" : "Sign Up")}
              </button>
            </form>

            <div style={{ marginTop: "16px", textAlign: "center", fontSize: "0.75rem", color: theme.textSub }}>
              {authMode === "signin" ? (
                <span>
                  Don't have an account?{" "}
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setAuthMode("signup"); setAuthStatusMsg(""); }}
                    style={{ color: "#00d09c", fontWeight: 700 }}
                  >
                    Create one
                  </a>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setAuthMode("signin"); setAuthStatusMsg(""); }}
                    style={{ color: "#00d09c", fontWeight: 700 }}
                  >
                    Sign In
                  </a>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
