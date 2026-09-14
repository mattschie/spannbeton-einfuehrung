import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const CONCRETE_CLASSES = [
  { label: "C20/25", fck: 20 },
  { label: "C25/30", fck: 25 },
  { label: "C30/37", fck: 30 },
  { label: "C35/45", fck: 35 },
  { label: "C40/50", fck: 40 },
  { label: "C45/55", fck: 45 },
  { label: "C50/60", fck: 50 },
];

const COL = {
  bg: "#0F1D33",
  panel: "#16283F",
  panelAlt: "#0F1E32",
  grid: "rgba(159,179,200,0.14)",
  ink: "#EAF0F6",
  inkDim: "#93AAC2",
  border: "rgba(159,179,200,0.22)",
  compression: "#F0B23C",
  tension: "#E15A3E",
  good: "#5FAF95",
};

const de = (v, d = 1) => {
  if (!isFinite(v)) return "–";
  return v.toFixed(d).replace(".", ",").replace("-", "\u2212");
};

function ParamSlider({ label, value, min, max, step, unit, onChange, decimals = 0 }) {
  return (
    <div className="param">
      <div className="param-row">
        <span className="param-label">{label}</span>
        <span className="param-value">{de(value, decimals)} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function App() {
  const [b, setB] = useState(30);
  const [h, setH] = useState(60);
  const [fckIdx, setFckIdx] = useState(3);
  const [P0, setP0] = useState(2000);
  const [loss, setLoss] = useState(8);
  const [eA, setEA] = useState(35);
  const [eF, setEF] = useState(35);
  const [eLinked, setELinked] = useState(true);
  const [qAdd, setQAdd] = useState(15);
  const [d1, setD1] = useState(4);
  const [L, setL] = useState(20);
  const [xSel, setXSel] = useState(10);
  const [showFormulas, setShowFormulas] = useState(false);

  const DENSITY = 25; // kN/m³, Wichte Stahlbeton
  const FYD = 435; // N/mm², Bemessungswert Betonstahlstreckgrenze (B500, γs = 1,15)

  const setEFLinked = (v) => { setEF(v); if (eLinked) setEA(v); };
  const toggleLink = () => setELinked((prev) => { const next = !prev; if (next) setEA(eF); return next; });

  const fck = CONCRETE_CLASSES[fckIdx].fck;
  const fckLabel = CONCRETE_CLASSES[fckIdx].label;
  const xClamped = Math.min(xSel, L);

  const geo = useMemo(() => {
    const bMm = b * 10, hMm = h * 10;
    const A = bMm * hMm;
    const W = (bMm * hMm * hMm) / 6;
    const fctm = 0.3 * Math.pow(fck, 2 / 3);
    const compLimit = 0.6 * fck;
    const eAMm = eA * 10, eFMm = eF * 10;
    const cover = 50; // mm, vereinfachte Mindest-Randlage der Spannglied-Schwerachse
    const coverWarning = Math.abs(eAMm) > hMm / 2 - cover || Math.abs(eFMm) > hMm / 2 - cover;

    const selfWeight = (A / 1e6) * DENSITY; // kN/m, Eigengewicht aus Querschnittsfläche
    const qTotal = qAdd + selfWeight; // kN/m

    const d1Mm = d1 * 10; // Randabstand der Bewehrung (beide Seiten symmetrisch angenommen)

    const computeAt = (x) => {
      const g = 1 - Math.abs(1 - (2 * x) / L); // 0 an den Auflagern, 1 in Feldmitte
      const Px = P0 * 1000 * (1 - (loss / 100) * g); // N
      const ex = eAMm + (eFMm - eAMm) * ((4 * x * (L - x)) / (L * L)); // mm, parabolische Führung
      const MqNmm = ((qTotal * x * (L - x)) / 2) * 1e6; // N*mm
      const MpNmm = Px * ex; // N*mm
      const sigmaBottom = Px / A + MpNmm / W - MqNmm / W;
      const sigmaTop = Px / A - MpNmm / W + MqNmm / W;

      // Erforderliche Bewehrung: Momentengleichgewicht der dreieckigen Zugzonen-
      // Ersatzkraft um die Nulllinie (Neutralachse), bezogen auf den tatsächlichen
      // Hebelarm zwischen Bewehrungslage (d₁) und Nulllinie. So gehen sowohl die
      // Vorspannung (über σ_o/σ_u, die P und e bereits enthalten) als auch der
      // Randabstand d₁ (über den Hebelarm) in As ein.
      let asTopMm2 = 0, asBottomMm2 = 0;
      if (sigmaTop < 0 && sigmaBottom < 0) {
        // Seltener Sonderfall: ganzer Querschnitt im Zug (keine Nulllinie im Querschnitt)
        const avg = Math.abs((sigmaTop + sigmaBottom) / 2);
        const totalF = avg * hMm * bMm;
        asTopMm2 = totalF / 2 / FYD;
        asBottomMm2 = totalF / 2 / FYD;
      } else if (sigmaTop < 0 || sigmaBottom < 0) {
        const denom = sigmaTop - sigmaBottom;
        const y0 = Math.abs(denom) > 1e-9 ? (sigmaTop / denom) * hMm : hMm / 2; // Nulllinie von oben
        if (sigmaTop < 0) {
          const hz = Math.max(y0, 0); // Höhe der Zugzone oben
          const Ft = 0.5 * Math.abs(sigmaTop) * hz * bMm;
          const aSteel = hz - d1Mm; // Hebelarm Bewehrung ↔ Nulllinie
          if (aSteel > 0) asTopMm2 = (Ft * (2 / 3) * hz / aSteel) / FYD;
        } else {
          const hz = Math.max(hMm - y0, 0); // Höhe der Zugzone unten
          const Ft = 0.5 * Math.abs(sigmaBottom) * hz * bMm;
          const aSteel = hz - d1Mm;
          if (aSteel > 0) asBottomMm2 = (Ft * (2 / 3) * hz / aSteel) / FYD;
        }
      }

      return {
        x, N: -(Px / 1000), P: Px / 1000, e: ex / 10,
        Mq: MqNmm / 1e6, Mp: MpNmm / 1e6, Mnet: (MqNmm - MpNmm) / 1e6,
        sigmaTop, sigmaBottom, asTopMm2, asBottomMm2,
      };
    };

    const points = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      points.push(computeAt((i / steps) * L));
    }

    return { A, W, fctm, compLimit, coverWarning, computeAt, points, bMm, hMm, selfWeight, qTotal, d1Mm };
  }, [b, h, fck, P0, loss, eA, eF, qAdd, d1, L]);

  const cur = geo.computeAt(xClamped);
  const asTopCm2 = cur.asTopMm2 / 100;
  const asBottomCm2 = cur.asBottomMm2 / 100;
  const minSigma = Math.min(cur.sigmaTop, cur.sigmaBottom);
  const maxSigma = Math.max(cur.sigmaTop, cur.sigmaBottom);

  let status, statusColor;
  if (maxSigma > geo.compLimit) {
    status = "Betondruckspannung überschritten (> 0,6·f_ck)";
    statusColor = COL.tension;
  } else if (minSigma < -geo.fctm) {
    status = "Rissbildung – Zugspannung übersteigt f_ctm";
    statusColor = COL.tension;
  } else if (minSigma < 0) {
    status = "Randzug vorhanden – Dekompression nicht eingehalten";
    statusColor = COL.compression;
  } else {
    status = "Querschnitt überdrückt – Dekompression eingehalten";
    statusColor = COL.good;
  }

  // --- Zeichengeometrie Querschnitt + Spannungsbild ---
  const boxW = 170, boxH = 250;
  const scale = Math.min(boxH / geo.hMm, boxW / geo.bMm);
  const drawH = geo.hMm * scale;
  const drawB = geo.bMm * scale;
  const secX = 30, secY = (boxH - drawH) / 2 + 10;
  const tendonY = secY + drawH / 2 + cur.e * 10 * scale;
  const rebarTopY = secY + geo.d1Mm * scale;
  const rebarBottomY = secY + drawH - geo.d1Mm * scale;

  const pxPerMPa = 4.2;
  const baseX = secX + drawB + 70;
  const topX = baseX + cur.sigmaTop * pxPerMPa;
  const bottomX = baseX + cur.sigmaBottom * pxPerMPa;

  let stressPolys = [];
  if (Math.sign(cur.sigmaTop) === Math.sign(cur.sigmaBottom) || cur.sigmaTop === 0 || cur.sigmaBottom === 0) {
    const c = cur.sigmaTop + cur.sigmaBottom >= 0 ? COL.compression : COL.tension;
    stressPolys = [{
      pts: `${baseX},${secY} ${topX},${secY} ${bottomX},${secY + drawH} ${baseX},${secY + drawH}`,
      c,
    }];
  } else {
    const t = cur.sigmaTop / (cur.sigmaTop - cur.sigmaBottom);
    const yCross = secY + t * drawH;
    stressPolys = [
      { pts: `${baseX},${secY} ${topX},${secY} ${baseX},${yCross}`, c: cur.sigmaTop >= 0 ? COL.compression : COL.tension },
      { pts: `${baseX},${yCross} ${bottomX},${secY + drawH} ${baseX},${secY + drawH}`, c: cur.sigmaBottom >= 0 ? COL.compression : COL.tension },
    ];
  }
  const crackX = baseX - geo.fctm * pxPerMPa;
  const compLimX = baseX + geo.compLimit * pxPerMPa;

  const xTick = (v) => de(v, 1);
  const sTick = (v) => de(v, 1);

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .app {
          background: ${COL.bg};
          background-image:
            linear-gradient(${COL.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${COL.grid} 1px, transparent 1px);
          background-size: 28px 28px;
          color: ${COL.ink};
          font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
          min-height: 100vh;
          padding: 28px 24px 60px;
        }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace; }
        header h1 {
          font-size: 22px; font-weight: 600; margin: 0 0 4px;
          letter-spacing: 0.2px;
        }
        header p {
          color: ${COL.inkDim}; margin: 0 0 22px; font-size: 14px; max-width: 640px; line-height: 1.5;
        }
        .layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 880px) {
          .layout { grid-template-columns: 1fr; }
        }
        .panel {
          background: ${COL.panel};
          border: 1px solid ${COL.border};
          border-radius: 4px;
          padding: 16px;
        }
        .panel + .panel { margin-top: 16px; }
        .section-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
          color: ${COL.inkDim}; margin: 0 0 12px; font-weight: 600;
        }
        .param { margin-bottom: 14px; }
        .param:last-child { margin-bottom: 0; }
        .param-row {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 12.5px; margin-bottom: 5px;
        }
        .param-label { color: ${COL.ink}; }
        .param-value {
          font-family: 'IBM Plex Mono', monospace; color: ${COL.inkDim}; font-size: 12px;
        }
        input[type=range] {
          -webkit-appearance: none; width: 100%; height: 3px;
          background: ${COL.border}; border-radius: 2px; outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%;
          background: ${COL.compression}; cursor: pointer; border: 2px solid ${COL.bg};
        }
        input[type=range]::-moz-range-thumb {
          width: 13px; height: 13px; border-radius: 50%;
          background: ${COL.compression}; cursor: pointer; border: 2px solid ${COL.bg};
        }
        select {
          width: 100%; background: ${COL.panelAlt}; color: ${COL.ink};
          border: 1px solid ${COL.border}; border-radius: 3px; padding: 6px 8px;
          font-family: 'IBM Plex Mono', monospace; font-size: 12.5px;
        }
        .link-btn {
          margin-top: 8px; width: 100%; text-align: left; cursor: pointer;
          background: ${COL.panelAlt}; color: ${COL.inkDim}; border: 1px solid ${COL.border};
          border-radius: 3px; padding: 6px 8px; font-size: 11px; font-family: 'IBM Plex Sans', sans-serif;
        }
        .link-btn:hover { color: ${COL.ink}; border-color: ${COL.inkDim}; }
        .static-readout {
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: ${COL.inkDim};
          line-height: 1.7; margin: -4px 0 14px;
        }
        .warn-box {
          margin-top: 14px; padding: 9px 10px; border-radius: 3px;
          background: rgba(225,90,62,0.14); border: 1px solid rgba(225,90,62,0.4);
          color: ${COL.tension}; font-size: 12px; line-height: 1.4;
        }
        .card {
          background: ${COL.panel}; border: 1px solid ${COL.border};
          border-radius: 4px; padding: 18px 20px; margin-bottom: 18px;
        }
        .card-title {
          font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
          color: ${COL.inkDim}; font-weight: 600; margin: 0 0 4px;
        }
        .hero-grid {
          display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: center;
        }
        @media (max-width: 700px) {
          .hero-grid { grid-template-columns: 1fr; }
        }
        .status-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 12px; border-radius: 3px; font-size: 12.5px; font-weight: 500;
          background: rgba(255,255,255,0.04); border: 1px solid ${COL.border};
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .readout-grid {
          display: grid; grid-template-columns: repeat(2, auto); gap: 6px 18px;
          font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; margin-top: 14px;
        }
        .readout-grid span.k { color: ${COL.inkDim}; }
        details summary {
          cursor: pointer; font-size: 12px; color: ${COL.inkDim};
          text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
        }
        details[open] summary { margin-bottom: 10px; }
        .formula-box {
          font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; line-height: 2;
          color: ${COL.ink}; white-space: pre-wrap;
        }
        .xslider-row { margin-bottom: 16px; }
        .legend-line { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; font-size: 11.5px; color: ${COL.inkDim}; }
        .legend-line span { display: inline-flex; align-items: center; gap: 5px; }
        .swatch { width: 12px; height: 2px; display: inline-block; }
      `}</style>

      <header>
        <h1>Spannbetonträger — Parameterstudie</h1>
        <p>
          Einfeldträger mit parabolisch geführtem Spannglied. Verändere Querschnitt, Vorspannung,
          Spanngliedführung und Last und beobachte Randspannungen sowie Schnittgrößen entlang der Trägerlänge.
        </p>
      </header>

      <div className="layout">
        {/* Steuerung */}
        <div>
          <div className="panel">
            <p className="section-title">Querschnitt</p>
            <ParamSlider label="Breite b" value={b} min={20} max={100} step={1} unit="cm" onChange={setB} />
            <ParamSlider label="Höhe h" value={h} min={30} max={150} step={1} unit="cm" onChange={setH} />
            <div className="param">
              <div className="param-row"><span className="param-label">Beton</span></div>
              <select value={fckIdx} onChange={(e) => setFckIdx(parseInt(e.target.value))}>
                {CONCRETE_CLASSES.map((c, i) => (
                  <option key={c.label} value={i}>{c.label} (f_ck = {c.fck} N/mm²)</option>
                ))}
              </select>
            </div>
            {geo.coverWarning && (
              <div className="warn-box">
                Spannglied liegt außerhalb der zulässigen Randlage (Mindestabstand ~5 cm zum Rand unterschritten).
              </div>
            )}
          </div>

          <div className="panel">
            <p className="section-title">Vorspannung</p>
            <ParamSlider label="Vorspannkraft P₀" value={P0} min={0} max={10000} step={50} unit="kN" onChange={setP0} />
            <ParamSlider label="Verlust bis Feldmitte" value={loss} min={0} max={20} step={0.5} unit="%" decimals={1} onChange={setLoss} />
            <ParamSlider label="Exzentrizität Feldmitte e_F" value={eF} min={-20} max={50} step={0.5} unit="cm" decimals={1} onChange={setEFLinked} />
            <div className="param">
              <div className="param-row">
                <span className="param-label">Exzentrizität Auflager eₐ</span>
                <span className="param-value">{de(eA, 1)} cm</span>
              </div>
              <input type="range" min={-20} max={40} step={0.5} value={eA} disabled={eLinked}
                onChange={(e) => setEA(parseFloat(e.target.value))} style={eLinked ? { opacity: 0.4 } : undefined} />
              <button className="link-btn" onClick={toggleLink}>
                {eLinked ? "🔗 verknüpft mit e_F — klicken zum Entkoppeln" : "🔓 unabhängig — klicken zum Verknüpfen"}
              </button>
            </div>
          </div>

          <div className="panel">
            <p className="section-title">Last &amp; Geometrie</p>
            <ParamSlider label="Zusätzliche Linienlast" value={qAdd} min={0} max={100} step={1} unit="kN/m" onChange={setQAdd} />
            <div className="static-readout">
              Eigengewicht g = A·{DENSITY} kN/m³ = <span className="mono">{de(geo.selfWeight, 1)} kN/m</span><br />
              Gesamtlast q = {de(geo.qTotal, 1)} kN/m
            </div>
            <ParamSlider label="Spannweite L" value={L} min={5} max={40} step={0.5} unit="m" decimals={1} onChange={(v) => { setL(v); setXSel(Math.min(xSel, v)); }} />
          </div>

          <div className="panel">
            <p className="section-title">Bewehrung</p>
            <ParamSlider label="Randabstand d₁" value={d1} min={2} max={15} step={0.5} unit="cm" decimals={1} onChange={setD1} />
          </div>
        </div>

        {/* Visualisierung */}
        <div>
          <div className="card">
            <p className="card-title">Querschnitt &amp; Randspannungen</p>
            <div className="xslider-row">
              <ParamSlider label={`Schnitt bei x`} value={xClamped} min={0} max={L} step={L / 100} unit="m" decimals={2} onChange={setXSel} />
            </div>

            <div className="hero-grid">
              <svg viewBox={`0 0 ${baseX + 140} ${boxH + 20}`} width="100%" height="270">
                <defs>
                  <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <rect width="7" height="7" fill={COL.panelAlt} />
                    <line x1="0" y1="0" x2="0" y2="7" stroke={COL.inkDim} strokeOpacity="0.35" strokeWidth="1" />
                  </pattern>
                </defs>

                {/* Querschnitt */}
                <rect x={secX} y={secY} width={drawB} height={drawH} fill="url(#hatch)" stroke={COL.inkDim} strokeWidth="1.2" />
                <circle cx={secX + drawB / 2} cy={tendonY} r="5" fill={COL.tension} stroke={COL.bg} strokeWidth="1" />
                {asTopCm2 > 0.001 && (
                  <>
                    <circle cx={secX + drawB * 0.28} cy={rebarTopY} r="4" fill="#7FB3E8" stroke={COL.bg} strokeWidth="1" />
                    <circle cx={secX + drawB * 0.72} cy={rebarTopY} r="4" fill="#7FB3E8" stroke={COL.bg} strokeWidth="1" />
                  </>
                )}
                {asBottomCm2 > 0.001 && (
                  <>
                    <circle cx={secX + drawB * 0.28} cy={rebarBottomY} r="4" fill="#7FB3E8" stroke={COL.bg} strokeWidth="1" />
                    <circle cx={secX + drawB * 0.72} cy={rebarBottomY} r="4" fill="#7FB3E8" stroke={COL.bg} strokeWidth="1" />
                  </>
                )}
                <text x={secX + drawB / 2} y={secY + drawH + 22} textAnchor="middle" fontSize="11" fill={COL.inkDim} fontFamily="'IBM Plex Mono', monospace">
                  {de(b, 0)}×{de(h, 0)} cm
                </text>
                <text x={secX + drawB / 2} y={tendonY - 10} textAnchor="middle" fontSize="10.5" fill={COL.tension} fontFamily="'IBM Plex Mono', monospace">
                  e = {de(cur.e, 1)} cm
                </text>

                {/* Nullachse / Baseline */}
                <line x1={baseX} y1={secY - 8} x2={baseX} y2={secY + drawH + 8} stroke={COL.inkDim} strokeWidth="1" strokeDasharray="2 3" />
                {/* Rissgrenze */}
                <line x1={crackX} y1={secY - 8} x2={crackX} y2={secY + drawH + 8} stroke={COL.tension} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
                {/* Druckgrenze */}
                <line x1={compLimX} y1={secY - 8} x2={compLimX} y2={secY + drawH + 8} stroke={COL.compression} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />

                {stressPolys.map((p, i) => (
                  <polygon key={i} points={p.pts} fill={p.c} fillOpacity="0.55" stroke={p.c} strokeWidth="1.3" />
                ))}

                <text x={topX + (cur.sigmaTop >= 0 ? 6 : -6)} y={secY + 3} fontSize="11" textAnchor={cur.sigmaTop >= 0 ? "start" : "end"} fill={COL.ink} fontFamily="'IBM Plex Mono', monospace">
                  σ_o = {de(cur.sigmaTop, 2)}
                </text>
                <text x={bottomX + (cur.sigmaBottom >= 0 ? 6 : -6)} y={secY + drawH + 3} fontSize="11" textAnchor={cur.sigmaBottom >= 0 ? "start" : "end"} fill={COL.ink} fontFamily="'IBM Plex Mono', monospace">
                  σ_u = {de(cur.sigmaBottom, 2)}
                </text>
              </svg>

              <div>
                <div className="status-pill">
                  <span className="dot" style={{ background: statusColor }} />
                  {status}
                </div>
                <div className="readout-grid">
                  <span className="k">σ oben</span><span>{de(cur.sigmaTop, 2)} N/mm²</span>
                  <span className="k">σ unten</span><span>{de(cur.sigmaBottom, 2)} N/mm²</span>
                  <span className="k">f_ctm (Riss)</span><span>{de(geo.fctm, 2)} N/mm²</span>
                  <span className="k">0,6·f_ck (Druck)</span><span>{de(geo.compLimit, 2)} N/mm²</span>
                  <span className="k">P(x)</span><span>{de(cur.P, 0)} kN</span>
                  <span className="k">M_q(x)</span><span>{de(cur.Mq, 0)} kNm</span>
                  <span className="k">As,erf oben</span><span>{cur.sigmaTop >= 0 ? "– (kein Zug)" : asTopCm2 > 0.0005 ? `${de(asTopCm2, 2)} cm²` : "0,00 cm² (Zugzone < d₁)"}</span>
                  <span className="k">As,erf unten</span><span>{cur.sigmaBottom >= 0 ? "– (kein Zug)" : asBottomCm2 > 0.0005 ? `${de(asBottomCm2, 2)} cm²` : "0,00 cm² (Zugzone < d₁)"}</span>
                </div>
                <div className="legend-line">
                  <span><span className="swatch" style={{ background: COL.compression }} /> Druck</span>
                  <span><span className="swatch" style={{ background: COL.tension }} /> Zug</span>
                  <span><span className="swatch" style={{ background: COL.tension }} /> Spannglied</span>
                  <span><span className="swatch" style={{ background: "#7FB3E8" }} /> Bewehrung</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="card-title">Schnittgrößen entlang der Trägerlänge</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={geo.points} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COL.grid} vertical={false} />
                <XAxis dataKey="x" tickFormatter={xTick} stroke={COL.inkDim} tick={{ fontSize: 11 }} label={{ value: "x [m]", position: "insideBottomRight", offset: -2, fill: COL.inkDim, fontSize: 11 }} />
                <YAxis yAxisId="M" stroke={COL.inkDim} tick={{ fontSize: 11 }} label={{ value: "M [kNm]", angle: -90, position: "insideLeft", fill: COL.inkDim, fontSize: 11 }} />
                <YAxis yAxisId="N" orientation="right" stroke={COL.inkDim} tick={{ fontSize: 11 }} label={{ value: "N [kN]", angle: 90, position: "insideRight", fill: COL.inkDim, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: COL.panelAlt, border: `1px solid ${COL.border}`, fontSize: 12 }} labelFormatter={(v) => `x = ${xTick(v)} m`} formatter={(v, n) => [de(v, 1), n]} />
                <Legend wrapperStyle={{ fontSize: 11, color: COL.inkDim }} />
                <ReferenceLine x={xClamped} yAxisId="M" stroke={COL.ink} strokeDasharray="3 3" opacity={0.5} />
                <Line yAxisId="M" type="monotone" dataKey="Mq" name="M_q (Last)" stroke={COL.tension} dot={false} strokeWidth={2} />
                <Line yAxisId="M" type="monotone" dataKey="Mp" name="M_p (Vorspannung)" stroke={COL.compression} dot={false} strokeWidth={2} />
                <Line yAxisId="N" type="monotone" dataKey="N" name="N (Normalkraft)" stroke={COL.inkDim} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="card-title">Randspannungen entlang der Trägerlänge</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={geo.points} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COL.grid} vertical={false} />
                <XAxis dataKey="x" tickFormatter={xTick} stroke={COL.inkDim} tick={{ fontSize: 11 }} label={{ value: "x [m]", position: "insideBottomRight", offset: -2, fill: COL.inkDim, fontSize: 11 }} />
                <YAxis tickFormatter={sTick} stroke={COL.inkDim} tick={{ fontSize: 11 }} label={{ value: "σ [N/mm²]", angle: -90, position: "insideLeft", fill: COL.inkDim, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: COL.panelAlt, border: `1px solid ${COL.border}`, fontSize: 12 }} labelFormatter={(v) => `x = ${xTick(v)} m`} formatter={(v, n) => [de(v, 2), n]} />
                <Legend wrapperStyle={{ fontSize: 11, color: COL.inkDim }} />
                <ReferenceLine y={0} stroke={COL.inkDim} strokeDasharray="2 3" label={{ value: "Dekompression", position: "insideTopLeft", fill: COL.inkDim, fontSize: 10 }} />
                <ReferenceLine y={-geo.fctm} stroke={COL.tension} strokeDasharray="4 3" label={{ value: "Rissgrenze", position: "insideBottomLeft", fill: COL.tension, fontSize: 10 }} />
                <ReferenceLine y={geo.compLimit} stroke={COL.compression} strokeDasharray="4 3" label={{ value: "Druckgrenze", position: "insideTopLeft", fill: COL.compression, fontSize: 10 }} />
                <ReferenceLine x={xClamped} stroke={COL.ink} strokeDasharray="3 3" opacity={0.5} />
                <Line type="monotone" dataKey="sigmaTop" name="σ oben" stroke="#7FB3E8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="sigmaBottom" name="σ unten" stroke="#E8C07F" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <details open={showFormulas} onToggle={(e) => setShowFormulas(e.target.open)}>
              <summary>Verwendete Formeln</summary>
              <div className="formula-box">
{`e(x) = eₐ + (e_F − eₐ) · 4x(L−x)/L²       (parabolische Spanngliedführung)
P(x) = P₀ · (1 − Verlust · g(x)),  g(x) = 1 − |1 − 2x/L|
g_Eigengewicht = A · 25 kN/m³              q = q_zusätzlich + g_Eigengewicht
M_q(x) = q·x·(L−x)/2                      M_p(x) = P(x)·e(x)
σ(y) = P(x)/A ± P(x)·e(x)/W ∓ M_q(x)/W    (+ am unteren, − am oberen Rand)
f_ctm ≈ 0,30 · f_ck^(2/3)                  Druckgrenze ≈ 0,6 · f_ck

Bewehrung (vereinfachte Näherung, kein voller ULS-Nachweis):
Nulllinie y₀ aus σ(y₀) = 0 (linear zw. σ_o und σ_u), Zugzonenhöhe hz
F_t = 0,5 · |σ_Rand| · hz · b            M₀ = F_t · (2/3) · hz  (Moment um y₀)
Hebelarm a = hz − d₁  (Bewehrungslage ↔ Nulllinie)
As,erf = M₀ / (a · f_yd)                  f_yd = 435 N/mm² (B500)
→ P und e wirken über σ_o/σ_u, d₁ wirkt über den Hebelarm a:
  je näher die Bewehrung an der Nulllinie liegt, desto mehr As wird nötig.
  Liegt d₁ außerhalb der Zugzone (hz ≤ d₁), wird As = 0 gesetzt.`}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
