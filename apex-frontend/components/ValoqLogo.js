import React from "react";

export default function ValoqLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
      <svg viewBox="0 0 72 72" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="valoqGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D09C" />
            <stop offset="60%" stopColor="#00F5A0" />
            <stop offset="100%" stopColor="#70FFAF" />
          </linearGradient>
          <linearGradient id="monolithSheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="darkBevel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id="vectorDrop" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#00D09C" floodOpacity="0.35" />
          </filter>
        </defs>
        <rect width="72" height="72" rx="18" fill="#090D14" stroke="#1E293B" strokeWidth="1.5" />
        <rect x="0.75" y="0.75" width="70.5" height="70.5" rx="17.25" fill="url(#monolithSheen)" />
        <path d="M 36 16 A 20 20 0 1 1 20 44" stroke="url(#darkBevel)" strokeWidth="5" strokeLinecap="round" />
        <path d="M 23 24 L 36 50" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
        <path d="M 36 50 L 52 20 M 42 42 L 56 56" stroke="url(#valoqGlow)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#vectorDrop)" />
        <circle cx="36" cy="50" r="3.2" fill="#00F5A0" />
      </svg>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A" }}>
            VALO<span style={{ color: "#00D09C" }}>Q</span>
          </span>
          <span style={{ fontSize: "0.62rem", fontWeight: 800, background: "#090D14", color: "#00F5A0", padding: "1px 4px", borderRadius: "3px" }}>
            PRO
          </span>
        </div>
        <div style={{ fontSize: "0.58rem", color: "#94A3B8", letterSpacing: "0.08em", fontWeight: 600 }}>
          VALUATION TERMINAL
        </div>
      </div>
    </div>
  );
}