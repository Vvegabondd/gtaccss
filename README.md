# 🎮 GTACCS — Game-Theoretic Adaptive Congestion Control System

> **An Interactive Simulation Platform** where data flows compete like rational players in a network game. Watch Nash Equilibrium emerge in real-time. 🚀

![React](https://img.shields.io/badge/React-18+-blue?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-16+-green?logo=node.js) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ and **npm**
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone or extract the project
cd gtaccs_v1-main

# Install dependencies
npm install

# Start development server
npm start
```

The app opens at **http://localhost:3000**

### First Steps
1. **🗺️ Topology Tab** — Explore the default network or design your own
2. **📊 Dashboard Tab** — Watch real-time simulation metrics
3. **▶️ Play Button** — Start the simulation (use controls at top)
4. **🎯 Analytics Tab** — Deep dive into equilibrium & payoff analysis
5. **⚔️ Compare Tab** — Compare strategy performance dynamically

---

## 📋 Available Tabs & Features

### 🗺️ **Topology Builder**
Customize your network topology:
- **Drag nodes** to reposition on canvas
- **Adjust link capacities** to control bottlenecks
- **Create custom flows** with specific source/destination paths
- **Save configuration** and switch to Dashboard

### 📊 **Dashboard**
Live simulation hub with:
- **Metric cards** — Throughput, Fairness, Congestion, **Equilibrium status** ✨
- **Network topology SVG** — Color-coded by congestion level
- **Congested nodes pane** — Scrollable list of bottleneck links
- **Per-flow sending rate chart** — Multi-line, all flows
- **Link utilization bars** — Per-link capacity usage
- **Live statistics table** — Real-time flow metrics

### 🧮 **Analytics**
Technical deep-dive with:
- **Equilibrium status badge** — Shows round when reached
- **Per-flow payoff & rate charts** with equilibrium reference lines
- **Configuration summary** — Topology, flows, payoff parameters
- **Round-by-round data log** — CSV-style table (last 40 rounds)
- **Equilibrium conditions checklist** — Validates Nash stability
- **Historical statistics** — Min/avg/peak rates, payoffs, delays per flow

### 🔀 **Flows**
Flow strategy configuration:
- **Add/Edit/Remove flows** (supports 2–6 flows)
- **Strategy selector** — Aggressive, Conservative, Adaptive with descriptions
- **Initial rate slider** — 5–100 Mbps
- **Multi-dimension radar** — Shows all flows across 5 metrics (Rate, Throughput, Payoff, Low Loss, Low Delay)
- **Rate vs Throughput bar chart** — Side-by-side comparison of all flows
- **Strategy reference cards** — Details on each strategy's rules & analogy

### 💰 **Payoff**
Payoff function tuning & analysis:
- **α slider** — Adjust delay sensitivity (default: 0.3)
- **β slider** — Adjust loss penalty weight (default: 2.0)
- **Live formula display** — U = T − (α × D) − (β × L × 100)
- **Per-flow payoff trends** — Chart showing all flows' payoff evolution

### ⚔️ **Compare** (Dynamic)
Strategy scenario comparison:
- **6 presets**: Mixed, Low-Traffic, Heavy-Congestion, Burst-Traffic, Fairness-Critical, Adaptive-Environment
- **Real-time simulation** — Each scenario runs 60 rounds with your current topology & parameters
- **5-axis radar chart** — Highlights active scenario with dynamic data
- **Performance bar charts** — Compare throughput, fairness, loss across scenarios
- **Game-theoretic insights** — Detailed analysis per scenario

---

## 🎮 Simulation Controls

| Control | Effect |
|---------|--------|
| **▶ Play** | Auto-advance rounds at selected speed |
| **⏸ Pause** | Freeze the simulation at current round |
| **⏭ Step** | Advance exactly 1 round (disabled during play) |
| **↺ Reset** | Restart from round 0 with fresh flows |
| **Speed Select** | Choose playback: 0.5x, 1x, 2x, 5x, 10x |

---

## 🔧 Simulation Engine: How It Works

### Per-Round Flow (src/simulation/engine.js)

Each `simulationStep()` executes:

```
1. Aggregate Link Demand — Sum rates of flows using each link
2. Compute Utilization — demand/capacity per link
3. Calculate Loss — Packet loss when demand exceeds capacity
4. Per-Flow Metrics — Throughput, delay, loss per flow
5. Payoff Calculation — U = T − (α×D) − (β×L×100)
6. Rate Update — Strategy-specific adjustment based on congestion
7. Smoothing — Dampen oscillations (90% suggested, 10% current)
8. Natural Nudging — Volatility-conditional fair-share nudging (rounds 18–40)
9. Equilibrium Check — Detect stability via payoff variance window
10. Sticky Latch — Once reached, equilibrium persists
```

### Strategies

| Strategy | Behavior | Model |
|----------|----------|-------|
| **Aggressive** | Rate × 1.08 (increase), Rate × 0.70 on loss | Greedy maximizer |
| **Conservative** | Rate + 0.8 (slow increase), Rate × 0.75 if loss | Risk-averse user |
| **Adaptive (AIMD)** | TCP-like sawtooth: additive increase, multiplicative decrease | TCP Reno/Cubic |

### Payoff Function

```
U(flow) = Throughput − (α × Delay) − (β × PacketLoss × 100)
```

- **Maximize**: actual Mbps delivered
- **Minimize**: end-to-end latency & packet loss
- **Trade-off**: weights α & β control sensitivity

### Jain's Fairness Index

```
J = (Σ throughput)² / (n × Σ throughput²)
```

- **1.0** = Perfect equality (all flows equal)
- **0.5** = One flow dominates
- **< 0.85** = Considered unfair

---

## 🎯 Game Theory Foundations

### What is Nash Equilibrium?

A stable state where:
- Each flow's payoff is locally optimized
- No unilateral rate change improves payoff
- System "settles" into a self-enforcing agreement

**In GTACCS:** Detected when all flows' payoff variance < threshold over a sliding window (typically rounds 20–50).

### Why It Matters

- Shows how **selfish agents can self-organize** without central coordination
- Demonstrates **fairness vs efficiency trade-offs** (achieving perfect fairness often reduces total throughput)
- Models **real-world internet** where users don't cooperate, yet stable allocations emerge

### Classic Example: Tragedy of the Commons

When all flows use **Aggressive** strategy:
- Each individually increases rate
- Collectively, total loss skyrockets
- Everyone ends up worse off than if they had cooperated
- Nash Equilibrium exists but produces poor outcomes for all

---

## 📦 File Structure

```
gtaccs_v1-main/
├── public/
│   └── index.html              # Root HTML template
├── src/
│   ├── App.js                  # Main app state & layout
│   ├── App.css                 # Global styles
│   ├── index.js                # React entry point
│   ├── simulation/
│   │   └── engine.js           # Core simulation engine (300+ lines)
│   └── components/
│       ├── TopologyBuilder.js  # Node/link editor
│       ├── Dashboard.js        # Live metrics & topology
│       ├── AnalyticsTab.js     # Detailed analytics & charts
│       ├── FlowsTab.js         # Flow strategy config (multi-flow radar & bar)
│       ├── PayoffTab.js        # Payoff function tuning
│       ├── ComparisonTab.js    # Dynamic scenario comparison
│       ├── NetworkTopology.js  # SVG topology renderer
│       └── FairnessGauge.js    # Fairness circular gauge
├── scripts/
│   └── test_sim.mjs            # Headless test (60 rounds)
├── package.json                # Dependencies & scripts
└── README.md                   # This file
```

---

## 🚀 Recent Improvements (v1.2+)

### ✅ Sticky Equilibrium State
- Once Nash Equilibrium is detected, state **persists** across rounds
- No false negatives after brief convergence wobbles
- **Dashboard** shows "REACHED — Round X" status

### ✅ Dynamic Comparison Tab
- Strategy scenarios **compute in real-time** (no more hardcoded values)
- Each scenario runs 60-round simulation with your current topology & α/β
- **5-axis radar** updates live with computed data
- Full parametric sensitivity included

### ✅ Natural Convergence Behavior
- Soft, volatility-conditional nudging to encourage fair-share allocation
- Only activates when payoff volatility exceeds threshold (relative stddev > 0.12)
- Nudge strength decays over time (0.5 → 0.25) for natural feel
- Convergence within 30–50 rounds, typical

### ✅ Multi-Flow Chart Fixes
- **Flows Tab radar** now displays all flows (not just F1) with per-flow polygons
- **Rate vs Throughput bar chart** reflects all flows
- Proper metric normalization across all flows

### ✅ Equilibrium UI Feedback
- **Dashboard metric card** shows Equilibrium status (REACHED/SEARCHING)
- **Top-right badge** flashes green with round number when reached
- **Analytics badge** displays equilibrium round persistently

---

## 📊 Example Scenarios

### Scenario: Mixed Strategies (Default)
- **Composition**: F1 (Aggressive), F2 (Adaptive), F3 (Conservative)
- **Outcome**: Moderate fairness (~0.68), partial equilibrium
- **Insight**: Heterogeneous strategies model real-world internet diversity

### Scenario: Fairness-Critical
- **Composition**: All flows use Adaptive (TCP AIMD)
- **Outcome**: High fairness (0.91+), fast convergence (~30 rounds)
- **Insight**: Homogeneous TCP-like strategies self-organize optimally

### Scenario: Heavy Congestion
- **Composition**: All flows use Aggressive
- **Outcome**: Low fairness (0.41), high loss (68%), negative payoff
- **Insight**: Tragedy of the Commons — rational selfish behavior destroys collective good

### Scenario: Adaptive Environment
- **Composition**: Mixed Adaptive & AIMD flows
- **Outcome**: Good throughput (62+ Mbps), stable convergence
- **Insight**: Diverse TCP variants coexist effectively

---

## 🛠️ Build & Deployment

### Development
```bash
npm start      # Dev server with hot reload at http://localhost:3000
```

### Production
```bash
npm run build  # Optimized bundle (~187 KB gzipped)
npm install -g serve
serve -s build # Serve production build locally
```

### Testing
```bash
node ./scripts/test_sim.mjs  # Run 60-round headless simulation with logging
```

---

## 🧩 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18+ | Component UI & state management |
| **Charts** | Recharts | Radar, bar, line, area visualizations |
| **Styling** | CSS3 Flexbox/Grid | Responsive, modern design |
| **Engine** | Vanilla JavaScript | High-performance simulation logic |
| **Build** | Create React App | Webpack, hot reload, optimization |
| **Runtime** | Node.js 16+ | Dev server & testing |

---

## 📚 Learning Outcomes

After using GTACCS, you'll understand:

- ✅ How **game theory** models distributed network behavior
- ✅ What **Nash Equilibrium** means and why it matters
- ✅ How **TCP congestion control** (AIMD) works mathematically
- ✅ Why **fairness** and **efficiency** often conflict in networks
- ✅ How to **measure performance** (throughput, loss, delay, payoff)
- ✅ The role of **strategy diversity** in self-organizing systems
- ✅ How to **detect convergence** and optimize for stability

---

## 💡 Quick Tips

### Tip 1: Watch the Equilibrium Badge
Keep an eye on the top-right badge. When it turns green and shows a round number, Nash Equilibrium has been reached!

### Tip 2: Adjust Payoff Weights
Try increasing **β (loss penalty)** in the Payoff tab to see flows become more loss-averse. Increase **α (delay weight)** to penalize latency more.

### Tip 3: Compare Strategies Dynamically
Switch to the **Compare** tab and click different scenarios. Metrics update in real-time based on your current topology and α/β!

### Tip 4: Zoom into Per-Flow Details
Use the **Analytics** tab to inspect individual flow payoff scores. Which flow is "winning"? Why?

### Tip 5: Design Custom Topologies
Build your own network in the **Topology** tab, add/remove flows, adjust rates, then hit **Reset** and **Play** to see how changes affect convergence speed.

---

## ❓ FAQ

**Q: Why does equilibrium take 20–50 rounds?**  
A: Flows need time to explore the payoff space, adapt to congestion signals, and converge to a mutually stable operating point.

**Q: Can I run without Node.js?**  
A: No, you need Node.js & npm to install dependencies and run the dev server.

**Q: Maximum number of flows?**  
A: Up to 6 flows. The engine is optimized for small multi-player games (3–4 players typical).

**Q: Does this simulate real TCP?**  
A: It models **simplified TCP dynamics** (AIMD core). Real TCP has features like selective ACK, fast recovery, etc., which aren't included.

**Q: Can I export simulation data?**  
A: The **Analytics** tab has a round-by-round table. You can screenshot or copy into Excel/CSV.

**Q: How does the "sticky" equilibrium work?**  
A: Once equilibrium is detected, an internal flag (`equilibriumRef.current`) latches to true. The flag only resets when you hit Reset or change topology/flows.

---

## 🤝 Contributing

Found a bug? Have a feature idea?
1. Test with `node ./scripts/test_sim.mjs`
2. Review `src/simulation/engine.js` for core logic
3. Check recent fixes in `src/components/`
4. Submit a pull request with details!

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

## 🎓 Academic References

| Concept | Source | Application |
|---------|--------|-------------|
| Nash Equilibrium | Game Theory (Nash, 1950) | Core solution concept for multi-player games |
| TCP AIMD | RFC 5681 | Congestion control algorithm |
| Jain's Fairness Index | Jain et al. (1984) | Standard metric for resource allocation fairness |
| Congestion Control | Floyd & Jacobson (1993) | TCP Tahoe/Reno design principles |
| Multi-Agent Systems | Russell & Norvig (AI) | Decentralized coordination without central control |

---

## 🌟 Made With

**React** · **Game Theory** · **Network Simulation** · **Love ❤️**

---

<div align="center">

[⬆ Back to Top](#-gtaccs--game-theoretic-adaptive-congestion-control-system)

</div>
