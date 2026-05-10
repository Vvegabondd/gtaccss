import React from 'react';
import { SCENARIOS } from '../simulation/engine';

export default function ScenarioPicker({ active, onSelect, onClose }) {
  return (
    <div className="scenario-overlay" onClick={onClose}>
      <div className="scenario-picker" onClick={e => e.stopPropagation()}>
        <div className="scenario-picker-header">
          <span className="scenario-picker-title">Choose Scenario</span>
          <button className="scenario-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="scenario-grid">
          {Object.entries(SCENARIOS).map(([key, sc]) => (
            <button
              key={key}
              className={'scenario-card' + (active === key ? ' active' : '')}
              onClick={() => onSelect(key)}
            >
              <span className="sc-icon">{sc.icon}</span>
              <span className="sc-name">{sc.name}</span>
              <span className="sc-desc">{sc.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
