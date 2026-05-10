import React, { useState, useRef, useCallback, useEffect } from 'react';

const FLOW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const CANVAS_W = 860;
const CANVAS_H = 380;
const NODE_R = 22;

function snapGrid(x, y) {
  return {
    x: Math.max(NODE_R + 4, Math.min(CANVAS_W - NODE_R - 4, x)),
    y: Math.max(NODE_R + 4, Math.min(CANVAS_H - NODE_R - 4, y)),
  };
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const DEFAULT_NODES = [
  { id: 'A', x: 80, y: 190, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'B', x: 220, y: 100, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'C', x: 220, y: 290, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'D', x: 380, y: 190, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'E', x: 500, y: 190, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'F', x: 620, y: 190, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'G', x: 750, y: 100, bandwidth: 1000, delay: 0, packetLoss: 0 },
  { id: 'H', x: 750, y: 290, bandwidth: 1000, delay: 0, packetLoss: 0 },
];

const DEFAULT_LINKS = [
  { from: 'A', to: 'B', capacity: 100 },
  { from: 'A', to: 'C', capacity: 80 },
  { from: 'B', to: 'D', capacity: 60 },
  { from: 'C', to: 'D', capacity: 70 },
  { from: 'D', to: 'E', capacity: 50 },
  { from: 'E', to: 'F', capacity: 100 },
  { from: 'F', to: 'G', capacity: 90 },
  { from: 'F', to: 'H', capacity: 80 },
];

const DEFAULT_FLOWS_INIT = [
  { id: 'F1', path: ['A', 'B', 'D', 'E', 'F', 'G'], strategy: 'aggressive', rate: 40, color: '#ef4444' },
  { id: 'F2', path: ['A', 'C', 'D', 'E', 'F', 'H'], strategy: 'adaptive', rate: 40, color: '#3b82f6' },
  { id: 'F3', path: ['B', 'D', 'E', 'F'], strategy: 'conservative', rate: 40, color: '#22c55e' },
];

/* ── Shared modal overlay styles ─────────────────────────────────── */
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalStyle = {
  background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
  padding: '28px 32px', minWidth: 340, maxWidth: 460,
  fontFamily: 'var(--font-ui, system-ui)',
};

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', marginTop: 4,
};

const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 };

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

/* ── Strategy pill selector ───────────────────────────────────────── */
const STRATEGIES = [
  { id: 'aggressive', label: 'Aggressive', color: '#ef4444', desc: 'Maximum throughput, ignores congestion' },
  { id: 'adaptive', label: 'Adaptive', color: '#3b82f6', desc: 'Dynamically adjusts to network state' },
  { id: 'conservative', label: 'Conservative', color: '#22c55e', desc: 'Low rate, avoids packet loss' },
  { id: 'aimd', label: 'TCP AIMD', color: '#f59e0b', desc: 'Additive increase, multiplicative decrease' },
];

function StrategySelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {STRATEGIES.map(s => (
        <label key={s.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
          padding: '8px 12px', borderRadius: 8,
          border: `2px solid ${value === s.id ? s.color : '#e2e8f0'}`,
          background: value === s.id ? `${s.color}12` : '#f8fafc',
          transition: 'all 0.15s',
        }}>
          <input type="radio" name="strategy" value={s.id}
            checked={value === s.id} onChange={() => onChange(s.id)}
            style={{ marginTop: 2, accentColor: s.color }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: value === s.id ? s.color : '#334155' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{s.desc}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function TopologyBuilder({ topology, onTopologyChange, onGoToDashboard }) {

  /* ── State ──────────────────────────────────────────────────────── */
  const [nodes, setNodes] = useState(() =>
    (topology?.nodes || DEFAULT_NODES).map(n => ({
      bandwidth: 1000, delay: 0, packetLoss: 0, ...n,
    }))
  );
  const [links, setLinks] = useState(topology?.links || DEFAULT_LINKS);
  const [flows, setFlows] = useState(topology?.flows || DEFAULT_FLOWS_INIT);

  const [mode, setMode] = useState('select');
  const [dragging, setDragging] = useState(null);
  const [linkStart, setLinkStart] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [selected, setSelected] = useState(null);

  /* Add Node modal */
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [pendingNodePos, setPendingNodePos] = useState(null);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeBW, setNewNodeBW] = useState('1000');
  const [newNodeDelay, setNewNodeDelay] = useState('0');
  const [newNodeLoss, setNewNodeLoss] = useState('0');

  /* Add Link modal */
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingCapacity, setPendingCapacity] = useState(null);
  const [capacityVal, setCapacityVal] = useState('100');

  /* Manual link form */
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualCap, setManualCap] = useState('100');

  /* Edit node modal */
  const [editNodeId, setEditNodeId] = useState(null);
  const [editNodeBW, setEditNodeBW] = useState('');
  const [editNodeDelay, setEditNodeDelay] = useState('');
  const [editNodeLoss, setEditNodeLoss] = useState('');

  /* Edit link modal */
  const [editLinkIdx, setEditLinkIdx] = useState(null);
  const [editLinkCap, setEditLinkCap] = useState('');

  /* Flow builder */
  const [draftFlow, setDraftFlow] = useState(null);
  const [draftPath, setDraftPath] = useState([]);
  const [editFlowIdx, setEditFlowIdx] = useState(null);
  const [flowStrategy, setFlowStrategy] = useState('adaptive');
  const [flowRate, setFlowRate] = useState('40');
  const [flowPanel, setFlowPanel] = useState(false);

  const svgRef = useRef(null);

  /* ── Sync to parent ─────────────────────────────────────────────── */
  useEffect(() => {
    onTopologyChange({ nodes, links, flows });
  }, [nodes, links, flows, onTopologyChange]);

  /* ── SVG coord helper ───────────────────────────────────────────── */
  function svgCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  /* ── Hit testing ────────────────────────────────────────────────── */
  function nodeAt(x, y) {
    return nodes.find(n => dist(n, { x, y }) <= NODE_R + 4);
  }

  function linkAt(x, y) {
    return links.findIndex(l => {
      const a = nodes.find(n => n.id === l.from);
      const b = nodes.find(n => n.id === l.to);
      if (!a || !b) return false;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return dist(a, { x, y }) < 10;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const px = a.x + t * dx - x, py = a.y + t * dy - y;
      return px * px + py * py < 64;
    });
  }

  /* ── Flow node click handler ────────────────────────────────────── */
  const handleFlowNodeClick = useCallback((nodeId) => {
    setDraftPath(prev => {
      if (prev.length === 0) return [nodeId];
      const last = prev[prev.length - 1];
      if (last === nodeId || prev.includes(nodeId)) return prev;
      const linked = links.some(l =>
        (l.from === last && l.to === nodeId) ||
        (l.from === nodeId && l.to === last)
      );
      if (!linked) return prev;
      return [...prev, nodeId];
    });
  }, [links]);

  /* ── Pointer handlers ───────────────────────────────────────────── */
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const { x, y } = svgCoords(e);
    const hit = nodeAt(x, y);

    if (draftFlow) {
      if (hit) handleFlowNodeClick(hit.id);
      return;
    }

    if (mode === 'select') {
      if (hit) {
        setSelected({ type: 'node', id: hit.id });
        setDragging({ nodeId: hit.id, offsetX: x - hit.x, offsetY: y - hit.y });
      } else {
        const li = linkAt(x, y);
        if (li >= 0) setSelected({ type: 'link', idx: li });
        else setSelected(null);
      }
    } else if (mode === 'addLink') {
      if (hit) {
        if (!linkStart) {
          setLinkStart(hit.id);
        } else if (hit.id !== linkStart) {
          const exists = links.some(l =>
            (l.from === linkStart && l.to === hit.id) ||
            (l.from === hit.id && l.to === linkStart)
          );
          if (!exists) {
            setPendingCapacity({ from: linkStart, to: hit.id });
            setCapacityVal('100');
            setShowLinkModal(true);
          }
          setLinkStart(null);
        } else {
          setLinkStart(null);
        }
      }
    } else if (mode === 'addNode') {
      const snapped = snapGrid(x, y);
      setPendingNodePos(snapped);
      setNewNodeLabel('');
      setNewNodeBW('1000');
      setNewNodeDelay('0');
      setNewNodeLoss('0');
      setShowNodeModal(true);
    } else if (mode === 'delete') {
      if (hit) {
        const id = hit.id;
        setNodes(prev => prev.filter(n => n.id !== id));
        setLinks(prev => prev.filter(l => l.from !== id && l.to !== id));
        setFlows(prev =>
          prev
            .map(f => ({ ...f, path: f.path.filter(p => p !== id) }))
            .filter(f => f.path.length >= 2)
        );
        setSelected(null);
      } else {
        const li = linkAt(x, y);
        if (li >= 0) {
          setLinks(prev => prev.filter((_, i) => i !== li));
          setSelected(null);
        }
      }
    }
  }, [mode, nodes, links, linkStart, draftFlow, handleFlowNodeClick]); // eslint-disable-line

  const handleMouseMove = useCallback((e) => {
    const { x, y } = svgCoords(e);
    setMousePos({ x, y });
    if (dragging) {
      const snapped = snapGrid(x - dragging.offsetX, y - dragging.offsetY);
      setNodes(prev => prev.map(n =>
        n.id === dragging.nodeId ? { ...n, ...snapped } : n
      ));
    }
  }, [dragging]); // eslint-disable-line

  const handleMouseUp = useCallback(() => setDragging(null), []);

  /* Double-click: open edit modals */
  const handleDblClick = useCallback((e) => {
    const { x, y } = svgCoords(e);
    const hit = nodeAt(x, y);
    if (hit) {
      setEditNodeId(hit.id);
      setEditNodeBW(String(hit.bandwidth ?? 1000));
      setEditNodeDelay(String(hit.delay ?? 0));
      setEditNodeLoss(String(hit.packetLoss ?? 0));
      return;
    }
    const li = linkAt(x, y);
    if (li >= 0) {
      setEditLinkIdx(li);
      setEditLinkCap(String(links[li].capacity));
    }
  }, [nodes, links]); // eslint-disable-line

  /* ── Add Node confirm ───────────────────────────────────────────── */
  function confirmAddNode() {
    const label = newNodeLabel.trim().toUpperCase();
    if (!label) { alert('Please enter a node ID/label.'); return; }
    if (nodes.find(n => n.id === label)) { alert(`Node "${label}" already exists.`); return; }
    setNodes(prev => [...prev, {
      id: label,
      ...pendingNodePos,
      bandwidth: parseInt(newNodeBW, 10) || 1000,
      delay: parseInt(newNodeDelay, 10) || 0,
      packetLoss: parseFloat(newNodeLoss) || 0,
    }]);
    setShowNodeModal(false);
    setPendingNodePos(null);
    setNewNodeLabel('');
  }

  /* ── Add Link confirm (canvas click) ────────────────────────────── */
  function confirmAddLink() {
    const cap = parseInt(capacityVal, 10);
    if (!cap || cap < 1) { alert('Enter a valid capacity (≥ 1).'); return; }
    setLinks(prev => [...prev, { from: pendingCapacity.from, to: pendingCapacity.to, capacity: cap }]);
    setShowLinkModal(false);
    setPendingCapacity(null);
  }

  /* ── Manual Add Link (side panel) ───────────────────────────────── */
  function confirmManualAddLink() {
    const from = manualFrom.trim().toUpperCase();
    const to = manualTo.trim().toUpperCase();
    const cap = parseInt(manualCap, 10);
    if (!from || !to) { alert('Enter both From and To node IDs.'); return; }
    if (from === to) { alert('From and To must be different nodes.'); return; }
    if (!nodes.find(n => n.id === from)) { alert(`Node "${from}" does not exist.`); return; }
    if (!nodes.find(n => n.id === to)) { alert(`Node "${to}" does not exist.`); return; }
    if (!cap || cap < 1) { alert('Enter a valid capacity (≥ 1).'); return; }
    const exists = links.some(l =>
      (l.from === from && l.to === to) ||
      (l.from === to && l.to === from)
    );
    if (exists) { alert('A link between these nodes already exists.'); return; }
    setLinks(prev => [...prev, { from, to, capacity: cap }]);
    setManualFrom(''); setManualTo(''); setManualCap('100');
  }

  /* ── Edit node confirm ──────────────────────────────────────────── */
  function confirmEditNode() {
    setNodes(prev => prev.map(n =>
      n.id === editNodeId
        ? {
          ...n,
          bandwidth: parseInt(editNodeBW, 10) || 1000,
          delay: parseInt(editNodeDelay, 10) || 0,
          packetLoss: parseFloat(editNodeLoss) || 0
        }
        : n
    ));
    setEditNodeId(null);
  }

  /* ── Edit link confirm ──────────────────────────────────────────── */
  function saveEditLink() {
    const cap = parseInt(editLinkCap, 10);
    if (!cap || cap < 1) return;
    setLinks(prev => prev.map((l, i) => i === editLinkIdx ? { ...l, capacity: cap } : l));
    setEditLinkIdx(null);
  }

  /* ── Flow path building ─────────────────────────────────────────── */
  function startBuildFlow() {
    setDraftPath([]);
    setDraftFlow(true);
    setMode('select');
    setFlowPanel(true);
    setEditFlowIdx(null);
    setFlowStrategy('adaptive');
    setFlowRate('40');
  }

  function cancelBuildFlow() {
    setDraftFlow(null);
    setDraftPath([]);
    setFlowPanel(false);
    setEditFlowIdx(null);
  }

  function confirmFlow() {
    if (draftPath.length < 2) { alert('Select at least 2 connected nodes for the flow.'); return; }
    const id = editFlowIdx != null ? flows[editFlowIdx].id : `F${flows.length + 1}`;
    const color = editFlowIdx != null ? flows[editFlowIdx].color : FLOW_COLORS[flows.length % FLOW_COLORS.length];
    const newFlow = {
      id, path: draftPath, strategy: flowStrategy,
      rate: parseFloat(flowRate) || 40, color,
      throughput: 0, delay: 0, lossRate: 0, payoff: 0,
    };
    if (editFlowIdx != null) {
      setFlows(prev => prev.map((f, i) => i === editFlowIdx ? newFlow : f));
    } else {
      setFlows(prev => [...prev, newFlow]);
    }
    setDraftFlow(null); setDraftPath([]); setFlowPanel(false); setEditFlowIdx(null);
  }

  function editFlow(idx) {
    const f = flows[idx];
    setEditFlowIdx(idx);
    setDraftPath([...f.path]);
    setFlowStrategy(f.strategy);
    setFlowRate(String(f.rate));
    setDraftFlow(true);
    setFlowPanel(true);
    setMode('select');
  }

  function removeFlow(idx) {
    setFlows(prev => prev.filter((_, i) => i !== idx));
  }

  function resetToDefault() {
    setNodes(DEFAULT_NODES);
    setLinks(DEFAULT_LINKS);
    setFlows(DEFAULT_FLOWS_INIT);
    setSelected(null);
    setMode('select');
    setDraftFlow(null);
    setDraftPath([]);
    setFlowPanel(false);
    setLinkStart(null);
  }

  /* ── Derived ────────────────────────────────────────────────────── */
  const isValid = nodes.length >= 2 && links.length >= 1 && flows.length >= 1 &&
    flows.every(f => f.path.length >= 2);

  const cursorStyle = mode === 'addNode' ? 'crosshair' :
    mode === 'addLink' ? 'cell' :
      mode === 'delete' ? 'not-allowed' :
        dragging ? 'grabbing' : 'default';

  const btnBase = {
    fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
    padding: '5px 13px', borderRadius: 7, cursor: 'pointer', border: '1.5px solid',
    transition: 'all 0.15s',
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top toolbar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
        padding: '10px 16px', boxShadow: 'var(--shadow-sm)',
      }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginRight: 4 }}>
          Mode:
        </span>
        {[
          { id: 'select', icon: '↖', label: 'Select / Drag' },
          { id: 'addNode', icon: '⊕', label: 'Add Node' },
          { id: 'addLink', icon: '⟷', label: 'Add Link' },
          { id: 'delete', icon: '✕', label: 'Delete' },
        ].map(m => (
          <button key={m.id}
            onClick={() => { setMode(m.id); setLinkStart(null); setDraftFlow(null); setDraftPath([]); }}
            style={{
              ...btnBase,
              borderColor: mode === m.id ? 'var(--accent)' : 'var(--border)',
              background: mode === m.id ? 'var(--accent-light)' : '#fff',
              color: mode === m.id ? 'var(--accent)' : 'var(--text2)',
            }}>
            {m.icon} {m.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={resetToDefault} style={{ ...btnBase, borderColor: 'var(--border)', background: '#fff', color: 'var(--text2)' }}>
          ↺ Reset Default
        </button>
        <button onClick={onGoToDashboard} disabled={!isValid} style={{
          fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
          padding: '6px 18px', borderRadius: 7, cursor: isValid ? 'pointer' : 'not-allowed',
          border: 'none',
          background: isValid ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#cbd5e1',
          color: '#fff', boxShadow: isValid ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
          transition: 'all 0.2s',
        }}>
          ▶ Launch Simulation →
        </button>
      </div>

      {/* ── Hint bar ───────────────────────────────────────────────── */}
      {(mode === 'addNode' || mode === 'addLink' || draftFlow) && (
        <div style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13,
          background: draftFlow ? '#eff6ff' : mode === 'addNode' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${draftFlow ? '#bfdbfe' : mode === 'addNode' ? '#bbf7d0' : '#fde68a'}`,
          color: draftFlow ? '#1d4ed8' : mode === 'addNode' ? '#15803d' : '#92400e',
          fontFamily: 'var(--font-ui)', fontWeight: 500,
        }}>
          {mode === 'addNode' && '⊕ Click anywhere on the canvas to place a new node — a dialog will open for its parameters.'}
          {mode === 'addLink' && !linkStart && '⟷ Click the source node on the canvas, then click the destination node to draw a link.'}
          {mode === 'addLink' && linkStart && `⟷ Source: ${linkStart} — now click the destination node.`}
          {draftFlow && draftPath.length === 0 && '🖊 Click a start node on the canvas to begin drawing the flow path.'}
          {draftFlow && draftPath.length > 0 && `🖊 Path: ${draftPath.join(' → ')} — click a connected node to extend, or confirm below.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>

        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: '#fff', border: '1.5px solid var(--border)',
            borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            <div style={{
              padding: '8px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text2)',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>🌐 Network Canvas</span>
              <span>{nodes.length} nodes</span>
              <span>·</span>
              <span>{links.length} links</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                Double-click a node or link to edit its parameters
              </span>
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              style={{ width: '100%', display: 'block', cursor: cursorStyle, userSelect: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDblClick}
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="0" cy="0" r="1" fill="#e2e8f0" />
                </pattern>
              </defs>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" opacity="0.7" />

              {/* Links */}
              {links.map((l, i) => {
                const a = nodes.find(n => n.id === l.from);
                const b = nodes.find(n => n.id === l.to);
                if (!a || !b) return null;
                const isSelected = selected?.type === 'link' && selected.idx === i;
                return (
                  <g key={`${l.from}-${l.to}-${i}`}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isSelected ? '#f59e0b' : '#cbd5e1'}
                      strokeWidth={isSelected ? 4 : 3} strokeLinecap="round" />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8}
                      textAnchor="middle" fill="#64748b" fontSize="10"
                      fontFamily="JetBrains Mono, monospace">
                      {l.capacity}
                    </text>
                  </g>
                );
              })}

              {/* Draft flow path highlight */}
              {draftPath.length > 1 && draftPath.map((id, i) => {
                if (i === 0) return null;
                const a = nodes.find(n => n.id === draftPath[i - 1]);
                const b = nodes.find(n => n.id === id);
                if (!a || !b) return null;
                return (
                  <line key={`dp-${i}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#2563eb" strokeWidth={3} strokeDasharray="6 3"
                    strokeLinecap="round" opacity={0.7} />
                );
              })}

              {/* Rubber-band link preview */}
              {mode === 'addLink' && linkStart && mousePos && (() => {
                const s = nodes.find(n => n.id === linkStart);
                return s ? (
                  <line x1={s.x} y1={s.y} x2={mousePos.x} y2={mousePos.y}
                    stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3"
                    strokeLinecap="round" pointerEvents="none" />
                ) : null;
              })()}

              {/* Nodes */}
              {nodes.map(n => {
                const isSelected = selected?.type === 'node' && selected.id === n.id;
                const inDraft = draftPath.includes(n.id);
                const isStart = draftPath[0] === n.id;
                return (
                  <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                    {isSelected && (
                      <circle r={NODE_R + 6} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
                    )}
                    {inDraft && (
                      <circle r={NODE_R + 5} fill={isStart ? '#22c55e' : '#2563eb'} opacity={0.2} />
                    )}
                    <circle r={NODE_R}
                      fill={inDraft ? (isStart ? '#f0fdf4' : '#eff6ff') : '#f8fafc'}
                      stroke={inDraft ? (isStart ? '#22c55e' : '#2563eb') : (mode === 'delete' ? '#ef4444' : '#2563eb')}
                      strokeWidth={isSelected ? 2.5 : 2} />
                    <text x="0" y="5" textAnchor="middle"
                      fill={inDraft ? (isStart ? '#15803d' : '#1e3a8a') : '#1e3a8a'}
                      fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                      {n.id}
                    </text>
                  </g>
                );
              })}

              {/* Link start indicator */}
              {mode === 'addLink' && linkStart && (() => {
                const s = nodes.find(n => n.id === linkStart);
                return s ? (
                  <circle cx={s.x} cy={s.y} r={NODE_R + 6}
                    fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 2" />
                ) : null;
              })()}
            </svg>
          </div>

          {/* ── Manual Link Form ─────────────────────────────────────── */}
          <div style={{
            background: '#fff', border: '1.5px solid var(--border)', borderRadius: 10,
            padding: '12px 16px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 10 }}>
              ⟷ Add Link Manually
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <span style={{ ...labelStyle, display: 'block' }}>From Node</span>
                <input value={manualFrom} onChange={e => setManualFrom(e.target.value.toUpperCase())}
                  placeholder="e.g. A"
                  style={{ ...inputStyle, width: 70, marginTop: 2 }} />
              </div>
              <div>
                <span style={{ ...labelStyle, display: 'block' }}>To Node</span>
                <input value={manualTo} onChange={e => setManualTo(e.target.value.toUpperCase())}
                  placeholder="e.g. B"
                  style={{ ...inputStyle, width: 70, marginTop: 2 }} />
              </div>
              <div>
                <span style={{ ...labelStyle, display: 'block' }}>Capacity (Mbps)</span>
                <input type="number" value={manualCap} onChange={e => setManualCap(e.target.value)}
                  min="1" placeholder="100"
                  style={{ ...inputStyle, width: 100, marginTop: 2 }} />
              </div>
              <button onClick={confirmManualAddLink}
                style={{ ...btnBase, borderColor: '#2563eb', background: '#eff6ff', color: '#2563eb', alignSelf: 'flex-end', height: 34 }}>
                Add Link
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Flow panel */}
          <div className="card">
            <div className="card-header">
              <span>Flows</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>{flows.length} configured</span>
            </div>
            <div className="card-body">
              {!flowPanel ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button className="ctrl-btn primary" onClick={startBuildFlow}>+ New Flow</button>
                    <button className="ctrl-btn ghost" onClick={() => setFlows(DEFAULT_FLOWS_INIT)}>Reset</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {flows.map((f, i) => {
                      const stratColor = STRATEGIES.find(s => s.id === f.strategy)?.color || '#64748b';
                      return (
                        <div key={f.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 8, background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12 }}>{f.id}</div>
                            <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {f.path.join(' → ')}
                            </div>
                            <div style={{ fontSize: 11, display: 'flex', gap: 6, marginTop: 2 }}>
                              <span style={{ color: stratColor, fontWeight: 600 }}>{f.strategy}</span>
                              <span style={{ color: '#94a3b8' }}>· {f.rate} Mbps</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => editFlow(i)} className="ctrl-btn ghost" style={{ padding: '3px 8px' }}>✏</button>
                            <button onClick={() => removeFlow(i)} className="ctrl-btn ghost" style={{ padding: '3px 8px' }}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                    {flows.length === 0 && (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                        No flows yet. Click "New Flow" to add one.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', fontFamily: 'var(--font-ui)' }}>
                    {editFlowIdx != null ? `✏ Edit Flow ${flows[editFlowIdx]?.id}` : '+ New Flow'}
                  </div>

                  <div>
                    <span style={labelStyle}>Path (click nodes on canvas)</span>
                    <div style={{
                      padding: '8px 10px', borderRadius: 8, background: '#f0f9ff',
                      border: '1.5px solid #bae6fd', fontFamily: 'JetBrains Mono', fontSize: 13,
                      minHeight: 36, color: draftPath.length ? '#0369a1' : '#94a3b8',
                    }}>
                      {draftPath.length ? draftPath.join(' → ') : 'No path yet…'}
                    </div>
                    <button onClick={() => setDraftPath([])}
                      style={{ ...btnBase, borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b', marginTop: 6, fontSize: 11 }}>
                      ↺ Clear Path
                    </button>
                  </div>

                  <div>
                    <span style={labelStyle}>Flow Strategy</span>
                    <StrategySelector value={flowStrategy} onChange={setFlowStrategy} />
                  </div>

                  <FieldRow label="Target Rate (Mbps)">
                    <input type="number" value={flowRate}
                      onChange={e => setFlowRate(e.target.value)}
                      min="1" max="10000"
                      style={inputStyle} />
                  </FieldRow>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={confirmFlow}
                      disabled={draftPath.length < 2}
                      style={{
                        ...btnBase, flex: 1,
                        borderColor: draftPath.length >= 2 ? '#2563eb' : '#e2e8f0',
                        background: draftPath.length >= 2 ? '#2563eb' : '#f1f5f9',
                        color: draftPath.length >= 2 ? '#fff' : '#94a3b8',
                      }}>
                      ✓ {editFlowIdx != null ? 'Save Flow' : 'Add Flow'}
                    </button>
                    <button onClick={cancelBuildFlow} className="ctrl-btn ghost">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Topology Actions */}
          <div className="card">
            <div className="card-header"><span>Topology Actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ctrl-btn primary" onClick={() => { setMode('addNode'); setDraftFlow(null); }}>⊕ Add Node</button>
                <button className="ctrl-btn primary" onClick={() => { setMode('addLink'); setDraftFlow(null); setLinkStart(null); }}>⟷ Add Link</button>
                <button className="ctrl-btn danger" onClick={() => { setMode('delete'); setDraftFlow(null); }}>✕ Delete</button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                • <b>Add Node</b>: switch to Add Node mode, then click canvas<br />
                • <b>Add Link</b>: click source node then destination, or use the manual form below the canvas<br />
                • <b>Delete</b>: click a node or link to remove it<br />
                • <b>Double-click</b> any node/link to edit its parameters
              </div>

              <div>
                <span style={labelStyle}>Nodes ({nodes.length})</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                  {nodes.map(n => (
                    <span key={n.id} style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                      fontFamily: 'JetBrains Mono',
                    }}>{n.id}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════ MODALS ════ */}

      {/* Add Node Modal */}
      {showNodeModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowNodeModal(false); }}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 16, color: '#1e3a8a' }}>
              ⊕ Add New Node
            </h3>
            <FieldRow label="Node ID / Label *">
              <input autoFocus value={newNodeLabel}
                onChange={e => setNewNodeLabel(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && confirmAddNode()}
                placeholder="e.g. I"
                maxLength={4}
                style={inputStyle} />
              <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                Must be unique. Short IDs work best (1–4 chars).
              </span>
            </FieldRow>
            <FieldRow label="Bandwidth (Mbps)">
              <input type="number" value={newNodeBW} onChange={e => setNewNodeBW(e.target.value)} min="1" style={inputStyle} />
            </FieldRow>
            <FieldRow label="Propagation Delay (ms)">
              <input type="number" value={newNodeDelay} onChange={e => setNewNodeDelay(e.target.value)} min="0" style={inputStyle} />
            </FieldRow>
            <FieldRow label="Packet Loss Rate (0–100%)">
              <input type="number" value={newNodeLoss} onChange={e => setNewNodeLoss(e.target.value)} min="0" max="100" step="0.1" style={inputStyle} />
            </FieldRow>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNodeModal(false)} style={{ ...btnBase, borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>Cancel</button>
              <button onClick={confirmAddNode} style={{ ...btnBase, borderColor: '#2563eb', background: '#2563eb', color: '#fff' }}>Add Node</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {showLinkModal && pendingCapacity && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowLinkModal(false); }}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 16, color: '#1e3a8a' }}>
              ⟷ New Link: {pendingCapacity.from} → {pendingCapacity.to}
            </h3>
            <FieldRow label="Link Capacity (Mbps)">
              <input autoFocus type="number" value={capacityVal}
                onChange={e => setCapacityVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmAddLink()}
                min="1" style={inputStyle} />
            </FieldRow>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowLinkModal(false); setPendingCapacity(null); }} style={{ ...btnBase, borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>Cancel</button>
              <button onClick={confirmAddLink} style={{ ...btnBase, borderColor: '#2563eb', background: '#2563eb', color: '#fff' }}>Add Link</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Node Modal */}
      {editNodeId && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setEditNodeId(null); }}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 16, color: '#1e3a8a' }}>
              ✏ Edit Node: {editNodeId}
            </h3>
            <FieldRow label="Bandwidth (Mbps)">
              <input autoFocus type="number" value={editNodeBW} onChange={e => setEditNodeBW(e.target.value)} min="1" style={inputStyle} />
            </FieldRow>
            <FieldRow label="Propagation Delay (ms)">
              <input type="number" value={editNodeDelay} onChange={e => setEditNodeDelay(e.target.value)} min="0" style={inputStyle} />
            </FieldRow>
            <FieldRow label="Packet Loss Rate (0–100%)">
              <input type="number" value={editNodeLoss} onChange={e => setEditNodeLoss(e.target.value)} min="0" max="100" step="0.1" style={inputStyle} />
            </FieldRow>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditNodeId(null)} style={{ ...btnBase, borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>Cancel</button>
              <button onClick={confirmEditNode} style={{ ...btnBase, borderColor: '#2563eb', background: '#2563eb', color: '#fff' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editLinkIdx !== null && links[editLinkIdx] && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setEditLinkIdx(null); }}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 16, color: '#1e3a8a' }}>
              ✏ Edit Link: {links[editLinkIdx].from} ↔ {links[editLinkIdx].to}
            </h3>
            <FieldRow label="Link Capacity (Mbps)">
              <input autoFocus type="number" value={editLinkCap}
                onChange={e => setEditLinkCap(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEditLink()}
                min="1" style={inputStyle} />
            </FieldRow>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditLinkIdx(null)} style={{ ...btnBase, borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>Cancel</button>
              <button onClick={saveEditLink} style={{ ...btnBase, borderColor: '#2563eb', background: '#2563eb', color: '#fff' }}>Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}