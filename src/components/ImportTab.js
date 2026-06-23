import React, { useState } from 'react';

const COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4'];

export function assignCoordinates(nodes, links) {
  if (nodes.every(n => typeof n.x === 'number' && typeof n.y === 'number')) {
    return nodes;
  }

  const routers = nodes.filter(n => n.type === 'router' || n.id.startsWith('R'));
  const switches = nodes.filter(n => n.type === 'switch' || n.id.startsWith('S'));
  const hosts = nodes.filter(n => n.type === 'host' || n.id.startsWith('H'));
  const others = nodes.filter(n => !routers.includes(n) && !switches.includes(n) && !hosts.includes(n));

  const rCount = routers.length;
  const routerPositions = routers.map((r, i) => {
    const x = rCount > 1 ? 380 + i * (240 / (rCount - 1)) : 500;
    const y = 130;
    return { ...r, x, y };
  });

  const sCount = switches.length;
  const switchPositions = switches.map((s, i) => {
    const isLeft = i < sCount / 2;
    const colIndex = isLeft ? i : i - Math.ceil(sCount / 2);
    const colSize = isLeft ? Math.ceil(sCount / 2) : sCount - Math.ceil(sCount / 2);
    const x = isLeft ? 220 : 740;
    const y = colSize > 1 ? 70 + colIndex * (120 / (colSize - 1)) : 130;
    return { ...s, x, y };
  });

  const hCount = hosts.length;
  const hostPositions = hosts.map((h, i) => {
    const isLeft = i < hCount / 2;
    const colIndex = isLeft ? i : i - Math.ceil(hCount / 2);
    const colSize = isLeft ? Math.ceil(hCount / 2) : hCount - Math.ceil(hCount / 2);
    const x = isLeft ? 80 : 880;
    const y = colSize > 1 ? 60 + colIndex * (140 / (colSize - 1)) : 130;
    return { ...h, x, y };
  });

  const oCount = others.length;
  const otherPositions = others.map((o, i) => {
    const x = 500;
    const y = oCount > 1 ? 60 + i * (140 / (oCount - 1)) : 130;
    return { ...o, x, y };
  });

  return [...routerPositions, ...switchPositions, ...hostPositions, ...otherPositions];
}

export default function ImportTab({ onImportSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [parsedData, setParsedData] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndParse = (text) => {
    try {
      const data = JSON.parse(text);
      setError(null);
      setSuccess(null);

      // Validate topology structure
      if (!data.topology) {
        throw new Error("Missing 'topology' object.");
      }
      const { routers, switches, hosts, links } = data.topology;
      if (!Array.isArray(routers) || !Array.isArray(switches) || !Array.isArray(hosts) || !Array.isArray(links)) {
        throw new Error("Topology must contain 'routers', 'switches', 'hosts', and 'links' arrays.");
      }

      // Validate links
      links.forEach((l, index) => {
        if (!l.source || !l.destination) {
          throw new Error(`Link at index ${index} is missing 'source' or 'destination'.`);
        }
        if (typeof l.bandwidth_mbps !== 'number' || l.bandwidth_mbps <= 0) {
          throw new Error(`Link ${l.source} -> ${l.destination} has invalid 'bandwidth_mbps'. Must be a positive number.`);
        }
      });

      // Validate flows
      if (!Array.isArray(data.flows)) {
        throw new Error("Missing 'flows' array.");
      }
      data.flows.forEach((f, index) => {
        const id = f.flow_id || f.id;
        if (!id) {
          throw new Error(`Flow at index ${index} is missing 'flow_id' or 'id'.`);
        }
        if (!f.source || !f.destination) {
          throw new Error(`Flow ${id} is missing 'source' or 'destination'.`);
        }
        if (!Array.isArray(f.path) || f.path.length === 0) {
          throw new Error(`Flow ${id} must have a non-empty 'path' array.`);
        }
        if (typeof f.throughput_mbps !== 'number' || f.throughput_mbps < 0) {
          throw new Error(`Flow ${id} has invalid 'throughput_mbps'.`);
        }
        if (f.packet_loss_percent !== undefined && (f.packet_loss_percent < 0 || f.packet_loss_percent > 100)) {
          throw new Error(`Flow ${id} has invalid 'packet_loss_percent'. Must be between 0 and 100.`);
        }
      });

      setParsedData(data);
      setSuccess(`Successfully validated "${data.network_name || 'Imported Dataset'}"!`);
    } catch (err) {
      setError(err.message);
      setParsedData(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => validateAndParse(event.target.result);
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => validateAndParse(event.target.result);
      reader.readAsText(file);
    }
  };

  const handleAnalyze = () => {
    if (!parsedData) return;

    // Convert components into combinedNodes and map links
    const { routers, switches, hosts, links } = parsedData.topology;
    const baseNodes = [
      ...routers.map(r => ({ id: r.id, type: 'router', ...r })),
      ...switches.map(s => ({ id: s.id, type: 'switch', ...s })),
      ...hosts.map(h => ({ id: h.id, type: 'host', ...h }))
    ];
    const nodes = assignCoordinates(baseNodes, links);

    const convertedLinks = links.map(l => ({
      from: l.source,
      to: l.destination,
      capacity: l.bandwidth_mbps,
      latency: l.latency_ms || 10,
      packet_loss_percent: l.packet_loss_percent || 0
    }));

    // Convert flows
    const flows = parsedData.flows.map((f, i) => ({
      id: f.flow_id || f.id,
      path: f.path,
      strategy: f.strategy || 'aimd',
      rate: f.throughput_mbps,
      throughput: f.throughput_mbps,
      delay: f.latency_ms || 10,
      lossRate: (f.packet_loss_percent || 0) / 100,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      jitter: f.jitter_ms || 0,
      packets_sent: f.packets_sent || 0,
      packets_received: f.packets_received || 0
    }));

    const importedPayload = {
      networkName: parsedData.network_name || "Imported Network",
      timestamp: parsedData.timestamp || new Date().toISOString(),
      topology: { nodes, links: convertedLinks, flows },
      flows,
      networkMetrics: parsedData.network_metrics || null
    };

    onImportSuccess(importedPayload);
  };

  return (
    <div className="import-container" style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: '#1a2340' }}>
        📥 Import Network Data
      </h2>
      <div className="info-box">
        Upload network captures, Wireshark files (JSON converted), Mininet topology data, or research datasets. GTACCS will parse the topology, compute performance/QoS metrics, and generate an analytical dashboard.
      </div>

      <div 
        className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <span style={{ fontSize: 36 }}>📄</span>
        <p style={{ margin: '10px 0', fontWeight: 600 }}>Drag and drop your network JSON file here</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 15px 0' }}>or click below to choose a file</p>
        <input 
          type="file" 
          id="file-upload" 
          accept=".json" 
          onChange={handleFileChange} 
          style={{ display: 'none' }}
        />
        <label htmlFor="file-upload" className="ctrl-btn primary" style={{ cursor: 'pointer', display: 'inline-block' }}>
          Browse Files
        </label>
      </div>

      {error && (
        <div className="alert-box error" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, color: '#dc2626' }}>
          <strong>❌ Validation Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="alert-box success" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, color: '#16a34a' }}>
          <strong>✓ Validated:</strong> {success}
        </div>
      )}

      {parsedData && (
        <div className="card">
          <div className="card-header">
            <span>📋</span>
            <span className="card-title">Dataset Summary</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <strong>Network Name:</strong> {parsedData.network_name || "N/A"}
              </div>
              <div>
                <strong>Timestamp:</strong> {parsedData.timestamp ? new Date(parsedData.timestamp).toLocaleString() : "N/A"}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 10 }}>
              <div style={{ textAlign: 'center', background: '#f8faff', padding: 8, borderRadius: 6, border: '1px solid #dde3f0' }}>
                <div style={{ fontSize: 10, color: '#8892b0' }}>Routers</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{parsedData.topology?.routers?.length || 0}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#f8faff', padding: 8, borderRadius: 6, border: '1px solid #dde3f0' }}>
                <div style={{ fontSize: 10, color: '#8892b0' }}>Switches</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{parsedData.topology?.switches?.length || 0}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#f8faff', padding: 8, borderRadius: 6, border: '1px solid #dde3f0' }}>
                <div style={{ fontSize: 10, color: '#8892b0' }}>Hosts</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{parsedData.topology?.hosts?.length || 0}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#f8faff', padding: 8, borderRadius: 6, border: '1px solid #dde3f0' }}>
                <div style={{ fontSize: 10, color: '#8892b0' }}>Links</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{parsedData.topology?.links?.length || 0}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#f8faff', padding: 8, borderRadius: 6, border: '1px solid #dde3f0' }}>
                <div style={{ fontSize: 10, color: '#8892b0' }}>Flows</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{parsedData.flows?.length || 0}</div>
              </div>
            </div>

            <button 
              className="ctrl-btn primary" 
              onClick={handleAnalyze} 
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, marginTop: 15 }}
            >
              🚀 Analyze Dataset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
