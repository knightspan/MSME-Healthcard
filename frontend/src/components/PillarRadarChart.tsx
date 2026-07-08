import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PillarScore } from "../types";

interface PillarRadarChartProps {
  pillars: PillarScore[];
}

const SHORT_LABEL: Record<string, string> = {
  revenueStability: "Revenue Stability",
  complianceHealth: "Compliance Health",
  cashFlowDiscipline: "Cash Flow Discipline",
  formalityPayrollStability: "Formality / Payroll",
};

export function PillarRadarChart({ pillars }: PillarRadarChartProps) {
  const data = pillars.map((p) => ({
    pillar: SHORT_LABEL[p.key] ?? p.label,
    score: p.score,
    applied: p.applied,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="pillar" tick={{ fill: "#475569", fontSize: 12 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Radar
          name="Pillar score"
          dataKey="score"
          stroke="#0f766e"
          fill="#0f766e"
          fillOpacity={0.35}
          strokeWidth={2}
          dot
        />
        <Tooltip
          formatter={(value, _name, item) => {
            const applied = (item?.payload as { applied?: boolean } | undefined)?.applied;
            return [`${value}/100${applied === false ? " (not applied — reweighted)" : ""}`, "Score"];
          }}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
