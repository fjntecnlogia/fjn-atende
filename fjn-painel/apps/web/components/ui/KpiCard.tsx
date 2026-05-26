import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "orange",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "orange" | "cyan" | "green" | "purple";
}) {
  const accentMap: Record<string, string> = {
    orange: "text-orange",
    cyan:   "text-cyan-400",
    green:  "text-green-400",
    purple: "text-purple-400",
  };
  return (
    <div className="card p-5 hover:border-orange/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="label">{label}</span>
        {icon && <span className={cn("opacity-60", accentMap[accent])}>{icon}</span>}
      </div>
      <p className={cn("font-display text-3xl font-extrabold", accentMap[accent])}>{value}</p>
      {hint && <p className="text-xs text-gray2 mt-1">{hint}</p>}
    </div>
  );
}
