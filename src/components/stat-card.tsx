import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "accent" | "danger";
};

const TONES: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  accent: "bg-accent/20 text-accent-foreground dark:text-accent",
  danger: "bg-destructive/15 text-destructive",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md",
            TONES[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          {hint && (
            <div className="truncate text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
