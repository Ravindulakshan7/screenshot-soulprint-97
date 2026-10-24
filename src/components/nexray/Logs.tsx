import { useEffect, useRef, useState } from "react";
import { Download, Eraser, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogs } from "@/hooks/use-nexray";
import type { LogLevel } from "@/lib/nexray-bridge";
import { cn } from "@/lib/utils";

const filters: { k: "all" | LogLevel; l: string }[] = [
  { k: "all", l: "All" }, { k: "info", l: "Info" }, { k: "warning", l: "Warning" }, { k: "error", l: "Error" },
];
const tone = { info: "text-success", warning: "text-warning", error: "text-destructive" };

export function Logs() {
  const { logs, clear } = useLogs();
  const [f, setF] = useState<"all" | LogLevel>("all");
  const end = useRef<HTMLDivElement>(null);
  const shown = f === "all" ? logs : logs.filter((l) => l.level === f);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [shown.length]);

  const exportLogs = () => {
    const txt = logs.map((l) => `${new Date(l.ts).toISOString()} [${l.level.toUpperCase()}] ${l.msg}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = `nexray-logs-${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border bg-background/40 p-1">
          {filters.map((x) => (
            <button key={x.k} onClick={() => setF(x.k)}
              className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", f === x.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x.l}
            </button>
          ))}
        </div>
        <div className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" /> UUIDs and passwords are redacted automatically
        </div>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={clear}><Eraser /> Clear</Button>
        <Button size="sm" onClick={exportLogs}><Download /> Export Logs</Button>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-titlebar p-4 font-mono text-xs leading-relaxed">
        {shown.length === 0 && <p className="text-muted-foreground">Waiting for log output…</p>}
        {shown.map((l) => (
          <div key={l.id} className="flex gap-3 select-text">
            <span className="shrink-0 text-muted-foreground">{new Date(l.ts).toLocaleTimeString([], { hour12: false })}</span>
            <span className={cn("w-12 shrink-0 font-semibold uppercase", tone[l.level])}>{l.level === "warning" ? "warn" : l.level}</span>
            <span className="break-all text-foreground/90">{l.msg}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}
