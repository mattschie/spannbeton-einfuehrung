import React, { useState, useEffect } from "react";

// ---------- Design tokens ----------
const C = {
  paper: "#FAF8F3",
  panel: "#F1ECE1",
  panelBorder: "#DCD4C4",
  ink: "#1E2124",
  inkSoft: "#5B5F60",
  grid: "#D8D2C5",
  steel: "#35618F",
  steelDark: "#1F3C57",
  steelLight: "#8FAEC8",
  amber: "#C1892E",
  red: "#B23A2E",
  green: "#3F7A54",
};

const CONCRETE_CLASSES = [
  { label: "C20/25", fck: 20, fctm: 2.2 },
  { label: "C25/30", fck: 25, fctm: 2.6 },
  { label: "C30/37", fck: 30, fctm: 2.9 },
  { label: "C35/45", fck: 35, fctm: 3.2 },
  { label: "C40/50", fck: 40, fctm: 3.5 },
  { label: "C45/55", fck: 45, fctm: 3.8 },
  { label: "C50/60", fck: 50, fctm: 4.1 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const de = (n, d = 1) => {
  if (!isFinite(n)) return "–";
  const s = n.toFixed(d);
  return (s === "-0" || s === "-0.0" || s === "-0.00" ? s.slice(1) : s).replace(".", ",");
};

function Slider({ label, value, min, max, step, unit, onChange, decimals = 0 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: C.inkSoft }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
          {de(value, decimals)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sb-slider"
      />
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.steelDark,
        fontWeight: 600,
        marginBottom: 10,
        borderBottom: `1px solid ${C.panelBorder}`,
        paddingBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function SpannbetonExplorer() {
  const [L, setL] = useState(12.5); // m
  const [b, setB] = useState(300); // mm
  const [h, setH] = useState(800); // mm
  const [P0, setP0] = useState(0); // kN
  const [eMid, setEMid] = useState(0); // mm, positive = unterhalb Schwerachse
  const [eEnd, setEEnd] = useState(0); // mm
  const [q, setQ] = useState(25); // kN/m
  const [classIdx, setClassIdx] = useState(2); // C30/37
  const [xFrac, setXFrac] = useState(0.5);

  const { fck, fctm } = CONCRETE_CLASSES[classIdx];
  const maxE = Math.max(20, h / 2 - 50);

  useEffect(() => {
    setEMid((v) => clamp(v, -maxE, maxE));
    setEEnd((v) => clamp(v, -maxE, maxE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  const xSel = xFrac * L;
  const A = b * h; // mm²
  const I = (b * Math.pow(h, 3)) / 12; // mm⁴
  const complimit = 0.6 * fck; // N/mm² (Betondruckgrenze, quasi-ständig, vereinfacht)

  const eAt = (x) => {
    const t = clamp(x / L, 0, 1);
    return eEnd + (eMid - eEnd) * 4 * t * (1 - t);
  };
  const mLoad = (x) => (q * x * (L - x)) / 2; // kNm
  const mP = (x) => (P0 * eAt(x)) / 1000; // kNm
  const mTotal = (x) => mLoad(x) - mP(x); // kNm
  const sigTop = (x) => {
    const M = mTotal(x) * 1e6; // Nmm
    const Pn = P0 * 1000; // N
    return -Pn / A - (M * (h / 2)) / I;
  };
  const sigBottom = (x) => {
    const M = mTotal(x) * 1e6;
    const Pn = P0 * 1000;
    return -Pn / A + (M * (h / 2)) / I;
  };

  const N_SAMPLES = 61;
  const xs = Array.from({ length: N_SAMPLES }, (_, i) => (i / (N_SAMPLES - 1)) * L);
  const loadVals = xs.map(mLoad);
  const totalVals = xs.map(mTotal);
  const topVals = xs.map(sigTop);
  const bottomVals = xs.map(sigBottom);

  let envBottom = { v: -Infinity, x: 0 };
  let envTop = { v: Infinity, x: 0 };
  xs.forEach((x, i) => {
    if (bottomVals[i] > envBottom.v) envBottom = { v: bottomVals[i], x };
    if (topVals[i] < envTop.v) envTop = { v: topVals[i], x };
  });

  const classify = (v) => {
    if (v < -complimit) return "over";
    if (v <= 0) return "comp";
    if (v <= fctm) return "decomp";
    return "crack";
  };
  const STATE_META = {
    over: { color: C.red, label: "Druckgrenze überschritten" },
    comp: { color: C.steel, label: "Überdrückt" },
    decomp: { color: C.amber, label: "Dekomprimiert, ungerissen" },
    crack: { color: C.red, label: "Rissbildung" },
  };

  const sT = sigTop(xSel);
  const sB = sigBottom(xSel);
  const govTension = Math.max(sT, sB);
  const govCompression = Math.min(sT, sB);
  const crackState = govTension > fctm ? "crack" : govTension > 0 ? "decomp" : "comp";
  const compOver = govCompression < -complimit;

  // ---------- Beam elevation geometry ----------
  const BW = 720, BH = 130, marginL = 55, marginR = 20;
  const plotW = BW - marginL - marginR;
  const xToPx = (x) => marginL + (x / L) * plotW;
  const beamCenterY = 62;
  const halfDepictionPx = 34;
  const scaleE = halfDepictionPx / (h / 2);
  const tendonY = (x) => beamCenterY + eAt(x) * scaleE;
  const tendonPath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${xToPx(x).toFixed(1)} ${tendonY(x).toFixed(1)}`).join(" ");

  // ---------- Moment diagram geometry ----------
  const MW = 720, MH = 170;
  const y0 = 85;
  const maxAbsM = Math.max(1, ...loadVals.map(Math.abs), ...totalVals.map(Math.abs)) * 1.15;
  const scaleM = 72 / maxAbsM;
  const yM = (m) => y0 + m * scaleM;
  const loadPath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${xToPx(x).toFixed(1)} ${yM(loadVals[i]).toFixed(1)}`).join(" ");
  const totalPath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${xToPx(x).toFixed(1)} ${yM(totalVals[i]).toFixed(1)}`).join(" ");

  // ---------- Cross-section + stress geometry ----------
  const SW = 440, SH = 340;
  const maxSecH = 260, maxSecW = 120;
  const sc = Math.min(maxSecH / h, maxSecW / b);
  const secTopY = 30;
  const secBottomY = secTopY + h * sc;
  const secCenterX = 95;
  const secLeft = secCenterX - (b * sc) / 2;
  const secRight = secCenterX + (b * sc) / 2;
  const secCenterY = (secTopY + secBottomY) / 2;
  const tendonDotY = secCenterY + eAt(xSel) * sc;

  const stressAxisX0 = 250;
  const domainMax = Math.max(1, Math.abs(sT), Math.abs(sB), fctm, complimit) * 1.2;
  const scaleS = 150 / domainMax;
  const sx = (v) => stressAxisX0 + v * scaleS;

  // Build discrete color bands for the stress trapezoid (linear between sT@top, sB@bottom)
  const bandFracs = new Set([0, 1]);
  [0, fctm, -complimit].forEach((thr) => {
    if (sB !== sT) {
      const f = (thr - sT) / (sB - sT);
      if (f > 0 && f < 1) bandFracs.add(f);
    }
  });
  const fracList = Array.from(bandFracs).sort((a, b) => a - b);
  const bands = [];
  for (let i = 0; i < fracList.length - 1; i++) {
    const f0 = fracList[i], f1 = fracList[i + 1];
    const mid = sT + (sB - sT) * ((f0 + f1) / 2);
    const state = classify(mid);
    bands.push({ f0, f1, color: STATE_META[state].color });
  }
  const yAt = (f) => secTopY + f * (secBottomY - secTopY);
  const vAt = (f) => sT + (sB - sT) * f;

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100%", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .sb-slider { -webkit-appearance: none; width: 100%; height: 4px; background: ${C.grid}; border-radius: 2px; outline: none; }
        .sb-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 3px; background: ${C.steelDark}; cursor: pointer; transform: rotate(45deg); border: none; }
        .sb-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 3px; background: ${C.steelDark}; cursor: pointer; border: none; }
        select.sb-select { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Title block */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          padding: "20px 24px",
          borderBottom: `2px solid ${C.ink}`,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Einfluss der Vorspannung</h1>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: "4px 0 0" }}>
            Einfeldträger mit parabolischem Spannglied — interaktives Modell für den Unterricht Spannbetonbau
          </p>
        </div>
        <div style={{ display: "flex", gap: 20, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: C.inkSoft }}>
          <div>A = <span style={{ color: C.ink }}>{de(A / 100, 0)}</span> cm²</div>
          <div>I = <span style={{ color: C.ink }}>{(I / 1e4).toLocaleString("de-DE", { maximumFractionDigits: 0 })}</span> cm⁴</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 24, padding: 24, alignItems: "start" }}>
        {/* Control panel */}
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
            <GroupLabel>Geometrie</GroupLabel>
            <Slider label="Spannweite L" value={L} min={4} max={30} step={0.5} unit="m" onChange={setL} decimals={1} />
            <Slider label="Breite b" value={b} min={200} max={1000} step={10} unit="mm" onChange={setB} decimals={0} />
            <Slider label="Höhe h" value={h} min={300} max={1500} step={10} unit="mm" onChange={setH} decimals={0} />
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
            <GroupLabel>Vorspannung</GroupLabel>
            <Slider label="Vorspannkraft P" value={P0} min={0} max={10000} step={50} unit="kN" onChange={setP0} decimals={0} />
            <Slider label="Exzentrizität Feldmitte e(L/2)" value={eMid} min={-maxE} max={maxE} step={5} unit="mm" onChange={setEMid} decimals={0} />
            <Slider label="Exzentrizität Auflager e(0), e(L)" value={eEnd} min={-maxE} max={maxE} step={5} unit="mm" onChange={setEEnd} decimals={0} />
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
            <GroupLabel>Last</GroupLabel>
            <Slider label="Gleichlast q (inkl. Eigengewicht)" value={q} min={5} max={100} step={1} unit="kN/m" onChange={setQ} decimals={0} />
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: 18 }}>
            <GroupLabel>Material</GroupLabel>
            <select
              className="sb-select"
              value={classIdx}
              onChange={(e) => setClassIdx(parseInt(e.target.value))}
              style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.panelBorder}`, borderRadius: 3, background: "white", fontSize: 13 }}
            >
              {CONCRETE_CLASSES.map((c, i) => (
                <option key={c.label} value={i}>{c.label}</option>
              ))}
            </select>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft, marginTop: 8, lineHeight: 1.6 }}>
              f_ctm = {de(fctm, 1)} N/mm²<br />
              0,6·f_ck = {de(complimit, 1)} N/mm²
            </div>
          </div>
        </div>

        {/* Diagrams */}
        <div>
          {/* Envelope status bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              padding: "12px 16px",
              background: "white",
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 4,
              marginBottom: 16,
              fontSize: 12.5,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <div>
              max. Zug Unterkante:&nbsp;
              <span style={{ color: STATE_META[classify(envBottom.v)].color, fontWeight: 600 }}>{de(envBottom.v, 2)} N/mm²</span>
              &nbsp;bei x = {de(envBottom.x, 1)} m
            </div>
            <div>
              max. Druck Oberkante:&nbsp;
              <span style={{ color: envTop.v < -complimit ? C.red : C.ink, fontWeight: 600 }}>{de(envTop.v, 2)} N/mm²</span>
              &nbsp;bei x = {de(envTop.x, 1)} m
            </div>
          </div>

          {/* Beam elevation */}
          <div style={{ background: "white", border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: "14px 16px", marginBottom: 4 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.steelDark, fontWeight: 600, marginBottom: 8 }}>
              Balken &amp; Spanngliedführung
            </div>
            <svg viewBox={`0 0 ${BW} ${BH}`} style={{ width: "100%", height: "auto", display: "block" }}>
              <rect x={marginL} y={beamCenterY - halfDepictionPx} width={plotW} height={halfDepictionPx * 2} fill="none" stroke={C.grid} strokeWidth="1.5" />
              <line x1={marginL} y1={beamCenterY} x2={marginL + plotW} y2={beamCenterY} stroke={C.grid} strokeDasharray="3,3" />
              {/* supports */}
              <polygon points={`${marginL},${beamCenterY + halfDepictionPx} ${marginL - 8},${beamCenterY + halfDepictionPx + 12} ${marginL + 8},${beamCenterY + halfDepictionPx + 12}`} fill={C.ink} />
              <polygon points={`${marginL + plotW},${beamCenterY + halfDepictionPx} ${marginL + plotW - 8},${beamCenterY + halfDepictionPx + 12} ${marginL + plotW + 8},${beamCenterY + halfDepictionPx + 12}`} fill={C.ink} />
              {/* tendon */}
              <path d={tendonPath} fill="none" stroke={C.steel} strokeWidth="2.5" />
              {/* x marker */}
              <line x1={xToPx(xSel)} y1={beamCenterY - halfDepictionPx - 8} x2={xToPx(xSel)} y2={beamCenterY + halfDepictionPx + 8} stroke={C.red} strokeDasharray="4,3" strokeWidth="1.5" />
              <circle cx={xToPx(xSel)} cy={tendonY(xSel)} r="4" fill={C.red} />
              <text x={xToPx(xSel)} y={beamCenterY - halfDepictionPx - 14} textAnchor="middle" fontSize="11" fontFamily="'IBM Plex Mono', monospace" fill={C.red}>
                x = {de(xSel, 1)} m
              </text>
            </svg>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={xFrac}
            onChange={(e) => setXFrac(parseFloat(e.target.value))}
            className="sb-slider"
            style={{ margin: "6px 0 16px" }}
          />

          {/* Moment diagram */}
          <div style={{ background: "white", border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.steelDark, fontWeight: 600, marginBottom: 8 }}>
              Momentenverlauf (positiv = Zug unten, nach unten aufgetragen)
            </div>
            <svg viewBox={`0 0 ${MW} ${MH}`} style={{ width: "100%", height: "auto", display: "block" }}>
              <line x1={marginL} y1={y0} x2={marginL + plotW} y2={y0} stroke={C.grid} strokeWidth="1.5" />
              <path d={loadPath} fill="none" stroke={C.steelLight} strokeWidth="2" strokeDasharray="5,4" />
              <path d={totalPath} fill="none" stroke={C.steelDark} strokeWidth="2.5" />
              <line x1={xToPx(xSel)} y1={12} x2={xToPx(xSel)} y2={MH - 12} stroke={C.red} strokeDasharray="4,3" strokeWidth="1.5" />
              <circle cx={xToPx(xSel)} cy={yM(mLoad(xSel))} r="3.5" fill={C.steelLight} />
              <circle cx={xToPx(xSel)} cy={yM(mTotal(xSel))} r="3.5" fill={C.steelDark} />
            </svg>
            <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 12, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
              <span><span style={{ display: "inline-block", width: 16, borderTop: `2px dashed ${C.steelLight}`, marginRight: 6, verticalAlign: "middle" }} /> M_q(x) = {de(mLoad(xSel), 0)} kNm</span>
              <span><span style={{ display: "inline-block", width: 16, borderTop: `2.5px solid ${C.steelDark}`, marginRight: 6, verticalAlign: "middle" }} /> M(x) = M_q − P·e(x) = {de(mTotal(xSel), 0)} kNm</span>
              <span>N(x) = −P = {de(-P0, 0)} kN</span>
            </div>
          </div>

          {/* Cross-section + stress */}
          <div style={{ background: "white", border: `1px solid ${C.panelBorder}`, borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.steelDark, fontWeight: 600, marginBottom: 8 }}>
              Querschnitt &amp; Randspannungen bei x = {de(xSel, 1)} m
            </div>
            <svg viewBox={`0 0 ${SW} ${SH}`} style={{ width: "100%", maxWidth: 460, height: "auto", display: "block" }}>
              {/* cross-section rectangle */}
              <rect x={secLeft} y={secTopY} width={secRight - secLeft} height={secBottomY - secTopY} fill="none" stroke={C.ink} strokeWidth="1.5" />
              <line x1={secLeft} y1={secCenterY} x2={secRight} y2={secCenterY} stroke={C.grid} strokeDasharray="3,3" />
              <circle cx={secCenterX} cy={tendonDotY} r="4.5" fill={C.steelDark} />
              <text x={secCenterX} y={secBottomY + 18} textAnchor="middle" fontSize="11" fill={C.inkSoft} fontFamily="'IBM Plex Mono', monospace">
                b×h
              </text>

              {/* stress axis */}
              <line x1={stressAxisX0} y1={secTopY - 10} x2={stressAxisX0} y2={secBottomY + 10} stroke={C.ink} strokeWidth="1" />
              {/* limit lines */}
              <line x1={sx(fctm)} y1={secTopY} x2={sx(fctm)} y2={secBottomY} stroke={C.amber} strokeDasharray="3,3" strokeWidth="1.2" />
              <text x={sx(fctm)} y={secTopY - 4} textAnchor="middle" fontSize="9.5" fill={C.amber} fontFamily="'IBM Plex Mono', monospace">f_ctm</text>
              <line x1={sx(-complimit)} y1={secTopY} x2={sx(-complimit)} y2={secBottomY} stroke={C.steel} strokeDasharray="3,3" strokeWidth="1.2" />
              <text x={sx(-complimit)} y={secTopY - 4} textAnchor="middle" fontSize="9.5" fill={C.steel} fontFamily="'IBM Plex Mono', monospace">0,6f_ck</text>

              {/* stress trapezoid, banded by state */}
              {bands.map((band, i) => (
                <polygon
                  key={i}
                  points={`${stressAxisX0},${yAt(band.f0)} ${sx(vAt(band.f0))},${yAt(band.f0)} ${sx(vAt(band.f1))},${yAt(band.f1)} ${stressAxisX0},${yAt(band.f1)}`}
                  fill={band.color}
                  opacity="0.35"
                />
              ))}
              <path
                d={`M ${sx(sT)} ${secTopY} L ${sx(sB)} ${secBottomY}`}
                fill="none"
                stroke={C.ink}
                strokeWidth="2"
              />

              <text x={sx(sT) + (sT >= 0 ? 8 : -8)} y={secTopY - 2} textAnchor={sT >= 0 ? "start" : "end"} fontSize="12" fontFamily="'IBM Plex Mono', monospace" fill={STATE_META[classify(sT)].color} fontWeight="600">
                {de(sT, 2)}
              </text>
              <text x={sx(sB) + (sB >= 0 ? 8 : -8)} y={secBottomY + 4} textAnchor={sB >= 0 ? "start" : "end"} fontSize="12" fontFamily="'IBM Plex Mono', monospace" fill={STATE_META[classify(sB)].color} fontWeight="600">
                {de(sB, 2)}
              </text>
              <text x={stressAxisX0} y={secBottomY + 32} textAnchor="middle" fontSize="10" fill={C.inkSoft} fontFamily="'IBM Plex Mono', monospace">
                ← Druck    Zug →    [N/mm²]
              </text>
            </svg>

            <div
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "6px 12px",
                borderRadius: 3,
                background: STATE_META[crackState].color + "22",
                border: `1px solid ${STATE_META[crackState].color}`,
                color: STATE_META[crackState].color,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {STATE_META[crackState].label}
              {compOver ? " · Betondruckgrenze überschritten" : ""}
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 16, lineHeight: 1.6, maxWidth: 640 }}>
            Vereinfachungen: konstante Vorspannkraft P entlang der Trägerachse (Reibungs- und Ankerverluste nicht abgebildet),
            Einfeldträger unter gleichmäßiger Streckenlast q, Rechteckquerschnitt, Betondruckgrenze vereinfacht mit 0,6·f_ck angesetzt
            (quasi-ständige Kombination), Dekompressions- und Rissgrenze an der jeweiligen Randfaser ausgewertet (σ = 0 bzw. σ = f_ctm).
          </p>
        </div>
      </div>
    </div>
  );
}
