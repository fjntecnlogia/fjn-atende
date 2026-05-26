import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  active:   "bg-green-500/15 text-green-400 border-green-500/30",
  paused:   "bg-orange/15 text-orange border-orange/30",
  closed:   "bg-gray2/15 text-gray2 border-gray2/30",
  pending:  "bg-orange/15 text-orange border-orange/30",
  taken:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/15 text-green-400 border-green-500/30",
  default:  "bg-navy4 text-light/80 border-border",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
