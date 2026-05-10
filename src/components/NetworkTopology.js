import React, { useEffect, useRef } from 'react';
import { NODE_POSITIONS } from '../simulation/engine';

function linkColor(util) {
  if (util > 0.9) return '#ef4444';
  if (util > 0.7) return '#f59e0b';
  return '#22c55e';
}

function linkWidth(util) {
  if (util > 0.9) return 4;
  if (util > 0.7) return 3;
  return 2;
}

export default function NetworkTopology({ flows, linkUtil = {}, congestedNodes = new Set(), topology = null, links = null }) {
  const animRef = useRef([]);
  // Build flow color map for animating packets
  const flowColors = {};
  (flows || []).forEach(f => {
    f.path.forEach((node, i) => {
      if (i < f.path.length - 1) {
        flowColors[`${node}-${f.path[i+1]}`] = f.color;
      }
    });
  });

  const W = 960, H = 260;

  // Active links and node positions: prefer passed topology, fallback to engine constants
  const activeLinks = Array.isArray(links) && links.length ? links : (topology?.links || []);

  // If topology nodes are provided, compute a scaled/centered mapping into this SVG viewport
  let positions = NODE_POSITIONS;
  if (topology && Array.isArray(topology.nodes) && topology.nodes.length) {
    const nodesArr = topology.nodes;
    const xs = nodesArr.map(n => n.x);
    const ys = nodesArr.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const margin = 36;
    const availW = W - margin * 2;
    const availH = H - margin * 2;
    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);
    const scale = Math.min(availW / rangeX, availH / rangeY);

    // Centering offsets when aspect ratios differ
    const usedW = rangeX * scale;
    const usedH = rangeY * scale;
    const offsetX = margin + Math.max(0, (availW - usedW) / 2);
    const offsetY = margin + Math.max(0, (availH - usedH) / 2);

    positions = nodesArr.reduce((m, n) => {
      const nx = offsetX + (n.x - minX) * scale;
      const ny = offsetY + (n.y - minY) * scale;
      return { ...m, [n.id]: { x: nx, y: ny } };
    }, {});
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%', minHeight: 220 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradient for bottleneck link */}
        <linearGradient id="bottleneckGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b"/>
          <stop offset="50%" stopColor="#ef4444"/>
          <stop offset="100%" stopColor="#f59e0b"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="congestionGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        {/* Arrow marker */}
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/>
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444"/>
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/>
        </marker>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e"/>
        </marker>
      </defs>

      {/* Background grid subtle */}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`vg-${i}`} x1={i*80} y1={0} x2={i*80} y2={H}
          stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2,6" opacity="0.5"/>
      ))}

      {/* Links */}
      {activeLinks.map((link, idx) => {
        const from = positions[link.from];
        const to   = positions[link.to];
        const key  = `${link.from}-${link.to}`;
        const util = linkUtil[key] || 0;
        const isBottleneck = key === 'D-E';
        const color = isBottleneck && util > 0.5 ? '#ef4444' : linkColor(util);
        const mId = util > 0.9 ? 'arrow-red' : util > 0.7 ? 'arrow-amber' : 'arrow-green';

        // Offset to not overlap node circle
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const nx = dx/len, ny = dy/len;
        const x1 = from.x + nx*22, y1 = from.y + ny*22;
        const x2 = to.x - nx*22,   y2 = to.y - ny*22;

        return (
          <g key={key}>
            {/* Shadow for congested */}
            {util > 0.85 && (
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#ef4444" strokeWidth="8" opacity="0.15"
                strokeLinecap="round"/>
            )}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isBottleneck ? (util > 0.5 ? '#ef4444' : '#f59e0b') : color}
              strokeWidth={linkWidth(util)}
              strokeLinecap="round"
              markerEnd={`url(#${mId})`}
              opacity={0.85}
            />
            {/* Capacity label */}
            <text
              x={(from.x + to.x)/2}
              y={(from.y + to.y)/2 - (from.y === to.y ? 8 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#64748b"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              dy={from.y !== to.y ? 0 : -8}
            >
              {link.capacity}
            </text>
            {/* Bottleneck label */}
            {isBottleneck && (
              <text x={(from.x+to.x)/2} y={(from.y+to.y)/2 + 16}
                textAnchor="middle" fill="#ef4444" fontSize="9"
                fontFamily="Space Grotesk, sans-serif" fontWeight="600">
                BOTTLENECK
              </text>
            )}
          </g>
        );
      })}

      {/* Animated packets along links */}
      {(flows || []).map(flow =>
        flow.path.slice(0, -1).map((node, i) => {
          const from = positions[node];
          const to   = positions[flow.path[i+1]];
          if (!from || !to) return null;
          const key = `${node}-${flow.path[i+1]}`;
          return (
            <AnimatedPacket
              key={`pkt-${flow.id}-${i}`}
              from={from} to={to} color={flow.color} flowId={flow.id} idx={i}
            />
          );
        })
      )}

      {/* Nodes (use computed positions so custom topology maps correctly) */}
      {Object.entries(positions).map(([node, pos]) => {
        const isCongested = congestedNodes.has(node);
        const isBottleneckNode = node === 'D' || node === 'E';
        const fill = isCongested ? '#fef2f2' : isBottleneckNode ? '#fff7ed' : '#eff6ff';
        const stroke = isCongested ? '#ef4444' : isBottleneckNode ? '#f59e0b' : '#2563eb';
        const strokeW = isCongested ? 2.5 : 2;

        return (
          <g key={node}>
            {/* Congestion pulse ring */}
            {isCongested && (
              <circle cx={pos.x} cy={pos.y} r="22" fill="none" stroke="#ef4444"
                strokeWidth="2" opacity="0.6">
                <animate attributeName="r" values="22;30;22" dur="1.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.2s" repeatCount="indefinite"/>
              </circle>
            )}
            {/* Node circle */}
            <circle cx={pos.x} cy={pos.y} r="19"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeW}
              filter={isCongested ? 'url(#congestionGlow)' : undefined}
            />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
              fill={isCongested ? '#dc2626' : isBottleneckNode ? '#92400e' : '#1e3a8a'}
              fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="700">
              {node}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(16, 12)">
        {[
          { color: '#22c55e', label: '< 70% util' },
          { color: '#f59e0b', label: '70–90%' },
          { color: '#ef4444', label: '> 90% (congested)' },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 120}, 0)`}>
            <rect x="0" y="0" width="12" height="4" rx="2" fill={item.color}/>
            <text x="16" y="4" fill="#64748b" fontSize="9" fontFamily="Space Grotesk, sans-serif"
              dominantBaseline="middle">{item.label}</text>
          </g>
        ))}
        <g transform="translate(360, 0)">
          <circle cx="6" cy="2" r="5" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.5"/>
          <text x="16" y="4" fill="#64748b" fontSize="9" fontFamily="Space Grotesk, sans-serif"
            dominantBaseline="middle">Congested node</text>
        </g>
      </g>
    </svg>
  );
}

// ── Animated Packet ────────────────────────────────────────
function AnimatedPacket({ from, to, color, flowId, idx }) {
  const duration = 1.2 + idx * 0.15;
  const delay = (flowId.charCodeAt(1) * 0.3 + idx * 0.4) % 1.5;

  return (
    <circle r="4" fill={color} opacity="0.85">
      <animateMotion dur={`${duration}s`} repeatCount="indefinite" begin={`${delay}s`}>
        <mpath href="#unused"/>
        <animateMotion
          path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </animateMotion>
      <animateMotion
        path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
        dur={`${duration}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
      />
    </circle>
  );
}
