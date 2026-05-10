import React from 'react';

export default function FairnessGauge({ value }) {
  const pct   = Math.round(value * 100);
  const color = value > 0.8 ? '#16a34a' : value > 0.5 ? '#f59e0b' : '#ef4444';
  const label = value > 0.8 ? 'High Equity' : value > 0.5 ? 'Moderate' : 'Low Equity';
  const arc   = value * 157;

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" viewBox="0 0 160 90">
        <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="#f0f4ff" strokeWidth="10" strokeLinecap="round"/>
        <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arc} 204`} style={{transition:'stroke-dasharray .4s,stroke .3s'}}/>
        <text x="80" y="74" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="JetBrains Mono">{pct}</text>
        <text x="80" y="88" textAnchor="middle" fill="#8892b0" fontSize="9" fontFamily="Space Grotesk">{label}</text>
      </svg>
      <div style={{fontFamily:'Space Grotesk',fontSize:11,color:'#8892b0'}}>Jain's Fairness Index</div>
    </div>
  );
}
