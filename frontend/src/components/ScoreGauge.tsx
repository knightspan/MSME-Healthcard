import type { ScoreBand } from "../types";
import { BAND_COLORS } from "../lib/bandColors";

interface ScoreGaugeProps {
  score: number;
  band: ScoreBand;
}

const CX = 150;
const CY = 150;
const RADIUS = 118;
const STROKE_WIDTH = 28;

const SEGMENTS: { band: ScoreBand; start: number; end: number }[] = [
  { band: "Poor", start: 0, end: 36 },
  { band: "Bad", start: 36, end: 72 },
  { band: "Average", start: 72, end: 108 },
  { band: "Good", start: 108, end: 144 },
  { band: "Excellent", start: 144, end: 180 },
];

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** angle: 0 = leftmost point of the semicircle, 180 = rightmost point, arcing over the top. */
function polarPoint(radius: number, angle: number) {
  const rad = degToRad(angle - 180);
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function describeArc(radius: number, startAngle: number, endAngle: number): string {
  const start = polarPoint(radius, endAngle);
  const end = polarPoint(radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function ScoreGauge({ score, band }: ScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const needleAngle = (clamped / 100) * 180;
  const needleTip = polarPoint(RADIUS - STROKE_WIDTH - 6, needleAngle);
  const needleColor = BAND_COLORS[band];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 175" className="w-full max-w-sm">
        {SEGMENTS.map((seg) => (
          <path
            key={seg.band}
            d={describeArc(RADIUS, seg.start, seg.end)}
            stroke={BAND_COLORS[seg.band]}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="butt"
          />
        ))}

        {/* Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#1f2937"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={9} fill="#1f2937" />
        <circle cx={CX} cy={CY} r={4} fill="#ffffff" />

        {/* Score readout */}
        <text x={CX} y={CY - 40} textAnchor="middle" fontSize="34" fontWeight={700} fill="#111827">
          {clamped.toFixed(1)}
        </text>
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          fontSize="14"
          fontWeight={600}
          fill={needleColor}
          letterSpacing="0.5"
        >
          {band.toUpperCase()}
        </text>
      </svg>
      <div className="flex w-full max-w-sm justify-between px-1 text-[11px] font-medium text-slate-500">
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}
