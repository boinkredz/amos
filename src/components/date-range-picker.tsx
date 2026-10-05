/**
 * DateRangePicker – Komponen filter rentang tanggal dengan shortcut.
 * Props:
 *   from, to: string "YYYY-MM-DD"
 *   onChange: (from: string, to: string) => void
 */
import { format, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Label singkat untuk tampilan, mis "Penugasan", default kosong */
  label?: string;
};

function fmt(d: Date) { return format(d, "yyyy-MM-dd"); }
function today() { return fmt(new Date()); }

export function DateRangePicker({ from, to, onChange, label }: DateRangePickerProps) {
  const rangeLabel = from === to
    ? format(new Date(from + "T00:00:00"), "d MMM yyyy")
    : `${format(new Date(from + "T00:00:00"), "d MMM")} – ${format(new Date(to + "T00:00:00"), "d MMM yyyy")}`;

  const setRange = (f: string, t: string) => onChange(f, t);

  const shiftRange = (delta: number) => {
    // Shift range by its own duration
    const diffDays = Math.round(
      (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000,
    );
    const step = diffDays + 1;
    const newFrom = new Date(from + "T12:00:00");
    newFrom.setDate(newFrom.getDate() + delta * step);
    const newTo = new Date(newFrom);
    newTo.setDate(newTo.getDate() + diffDays);
    setRange(fmt(newFrom), fmt(newTo));
  };

  const isToday = from === today() && to === today();
  const is7 = to === today() && from === fmt(subDays(new Date(), 6));
  const is30 = to === today() && from === fmt(subDays(new Date(), 29));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-sm text-muted-foreground">{label}</span>}

      {/* Shortcut chips */}
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant={isToday ? "default" : "secondary"}
          className="h-7 text-xs px-2"
          onClick={() => setRange(today(), today())}
        >
          Hari Ini
        </Button>
        <Button
          size="sm" variant={is7 ? "default" : "secondary"}
          className="h-7 text-xs px-2"
          onClick={() => setRange(fmt(subDays(new Date(), 6)), today())}
        >
          7 Hari
        </Button>
        <Button
          size="sm" variant={is30 ? "default" : "secondary"}
          className="h-7 text-xs px-2"
          onClick={() => setRange(fmt(subDays(new Date(), 29)), today())}
        >
          30 Hari
        </Button>
      </div>

      {/* Prev / label / next */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftRange(-1)}>
          <ChevronLeft className="size-3.5" />
        </Button>
        <div className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium min-w-[130px] justify-center">
          <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
          {rangeLabel}
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftRange(1)}>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => { if (e.target.value) setRange(e.target.value, e.target.value > to ? e.target.value : to); }}
          className="h-7 rounded border px-2 text-xs bg-background text-foreground"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => { if (e.target.value) setRange(from < e.target.value ? from : e.target.value, e.target.value); }}
          className="h-7 rounded border px-2 text-xs bg-background text-foreground"
        />
      </div>
    </div>
  );
}
