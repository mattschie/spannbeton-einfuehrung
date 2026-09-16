# Spannbetonträger — Parameterstudie

Interaktive React-Lernapp für die Vorlesung Spannbetonbau. Zeigt an einem
Einfeldträger mit parabolisch geführtem Spannglied den Einfluss der
wichtigsten Parameter auf Randspannungen, Schnittgrößen und die
erforderliche Bewehrung.

## Features

- **Querschnitt & Beton**: Breite, Höhe, Betonklasse (C20/25–C50/60, inkl. E_cm nach EC2)
- **Vorspannung**: Vorspannkraft P₀ (0–10.000 kN), Reibungsverlust bis Feldmitte,
  parabolische Spanngliedführung mit Exzentrizität am Auflager und in Feldmitte
  (koppelbar/entkoppelbar über einen Button)
- **Last**: zusätzliche Linienlast, Eigengewicht wird automatisch aus der
  Querschnittsfläche (Wichte 25 kN/m³) berechnet
- **Ausgaben**:
  - Querschnitt mit Spannungstrapez (Druck/Zug farblich getrennt) an einer
    frei wählbaren Schnittstelle x, mit Ampel-Status (überdrückt /
    dekomprimiert / gerissen)
  - Momenten- und Normalkraftverlauf über die Trägerlänge
  - Randspannungsverlauf mit Referenzlinien für Dekompression, Rissbildung
    (f_ctm) und Druckgrenze (0,6·f_ck)
  - Erforderliche Biegebewehrung oben/unten (Dehnungsgleichgewicht, Zustand II,
    berücksichtigt E_cm), Randabstand d₁ frei wählbar
- Ausklappbarer Formelblock mit allen verwendeten Gleichungen

## Wichtige Vereinfachungen

- Reibungsverluste als einfache dreieckförmige Abnahme von den Auflagern zur
  Feldmitte (kein exaktes Reibungsgesetz)
- f_ctm nach Näherungsformel 0,30·f_ck^(2/3), gültig nur bis C50/60
- Nur eine Lastkombination (keine Kriech-/Schwind-/Relaxationsverluste über
  die Zeit)
- Bewehrung: vereinfachte Näherung über Dehnungsgleichgewicht mit der
  Annahme "Stahl fließt" (f_yd = 435 N/mm², B500) — kein vollständiger
  ULS-Nachweis

Die App ist als Lehr-/Visualisierungswerkzeug gedacht, nicht als
Bemessungssoftware für reale Bauvorhaben.

## Technik

- React (Hooks: `useState`, `useMemo`)
- [Recharts](https://recharts.org/) für die Diagramme
- Eine einzelne Datei: `spannbeton-parameterstudie.jsx`

## Disclaimer

Die App wurde mit gemeinsam mit Claude AI erstellt.
