import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function StepBadge({ step }: { step: number }) {
  return (
    <Badge className="w-6 h-6 rounded-md justify-center no-default-active-elevate flex-shrink-0">
      {step}
    </Badge>
  );
}

export function KpiCard({
  label,
  value,
  testId,
  accent,
}: {
  label: string;
  value: string;
  testId: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`p-3.5 transition-colors ${
        accent
          ? "bg-primary/5 dark:bg-primary/10 border-primary/10 dark:border-primary/20"
          : ""
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold mt-1.5 tabular-nums" data-testid={testId}>
        {value}
      </p>
    </Card>
  );
}

export function money(n: number): string {
  return n.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

export function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
