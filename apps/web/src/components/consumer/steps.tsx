import { cn } from "@/lib/utils";

const STEPS = ["Medidas", "Foto (opcional)", "Catálogo"];

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-[11px] font-medium",
                active && "border-ink bg-ink text-ivory",
                done && "border-sage bg-sage text-white",
                !active && !done && "border-border bg-paper text-stone",
              )}
            >
              {n}
            </span>
            <span className={cn("hidden text-xs sm:block", active ? "text-ink" : "text-stone")}>{label}</span>
            {n < STEPS.length ? <span className="mx-1 h-px w-6 bg-mist" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
