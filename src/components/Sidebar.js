import React from 'react';
import { SCENARIOS } from '../simulation/engine';

export default function Sidebar({ mode, setMode, activeScenario, onSelectScenario }) {
  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="section-title">Mode Selection</div>
        <div className="mode-switcher">
          <button 
            className={`mode-btn ${mode === 'playground' ? 'active' : ''}`}
            onClick={() => setMode('playground')}
          >
            <span className="mode-icon">🧪</span>
            <div className="mode-info">
              <div className="mode-name">Playground</div>
              <div className="mode-desc">Algorithm testing</div>
            </div>
          </button>
          <button 
            className={`mode-btn ${mode === 'arena' ? 'active' : ''}`}
            onClick={() => setMode('arena')}
          >
            <span className="mode-icon">🏟️</span>
            <div className="mode-info">
              <div className="mode-name">Arena</div>
              <div className="mode-desc">Scenario Analysis</div>
            </div>
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-title">Scenario Presets</div>
        <div className="scenario-list">
          {Object.entries(SCENARIOS).map(([key, sc]) => (
            <button
              key={key}
              className={`scenario-item ${activeScenario === key ? 'active' : ''}`}
              onClick={() => onSelectScenario(key)}
            >
              <span className="sc-mini-icon">{sc.icon}</span>
              <div className="sc-mini-info">
                <div className="sc-mini-name">{sc.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-spacer" />
      
      <div className="sidebar-footer">
        <div className="project-info">
          GTACCS v2.1
          <span>Game-Theoretic Simulation</span>
        </div>
      </div>
    </div>
  );
}
