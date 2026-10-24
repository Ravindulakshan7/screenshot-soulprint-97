import { Power, ArrowDown, ArrowUp, Globe, ShieldCheck, Server } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Switch } from "@/components/ui/switch";
import { useNexray, useNow, useTelemetry } from "@/hooks/use-nexray";
import { fmtBytes, getBridge } from "@/lib/nexray-bridge";
import { cn } from "@/lib/utils";
import { ProtoBadge, LatencyBadge } from "./badges";

function fmtDur(ms: number) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

export function Dashboard() {
  const s = useNexray();
  const now = useNow();
  const series = useTelemetry();
  const last = series[series.length - 1];
  const active = s.profiles.find((p) => p.id === s.activeId);
  const busy = s.conn === "Connecting" || s.conn === "Disconnecting";
  const on = s.conn === "Connected";

  const toggle = () => {
    const b = getBridge();
    if (on) b.disconnect();
    else if (s.conn === "Disconnected" && active) b.connect(active.id);
  };

  return (
    <div className="grid h-full grid-cols-[1.1fr_1fr] gap-5 p-6">
      {/* Connect */}
      <section className="glass relative flex flex-col items-center justify-center rounded-2xl p-6">
        <div className="relative flex h-60 w-60 items-center justify-center">
          {on && <div className="animate-ring-pulse absolute inset-0 rounded-full border-2 border-success" />}
          {busy && (
            <div className="animate-ring-spin absolute inset-2 rounded-full border-[3px] border-transparent border-t-primary border-r-primary" />
          )}
          <div className={cn("absolute inset-6 rounded-full border", on ? "border-success/50" : "border-border")} />
          <button
            onClick={toggle}
            disabled={busy || !active}
            aria-label={on ? "Disconnect" : "Connect"}
            className={cn(
              "relative flex h-36 w-36 items-center justify-center rounded-full transition-all duration-500 disabled:cursor-not-allowed",
              on ? "bg-success text-success-foreground glow-success" : "bg-secondary text-muted-foreground hover:text-foreground hover:glow-primary",
              busy && "text-primary",
            )}
          >
            <Power className="h-14 w-14" strokeWidth={2.4} />
          </button>
        </div>
        <p className={cn("mt-4 text-lg font-semibold tracking-wide", on ? "text-success" : busy ? "text-primary" : "text-muted-foreground")}>
          {s.conn}
        </p>
        <p className="font-mono text-3xl tabular-nums">{on && s.connectedAt ? fmtDur(now - s.connectedAt) : "00:00:00"}</p>

        <div className="mt-6 w-full rounded-xl border bg-background/40 p-4">
          {active ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Server className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{active.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{active.host}:{active.port}</p>
              </div>
              <ProtoBadge p={active} />
              <LatencyBadge v={active.tcpLatency} label="TCP" />
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">No server selected — pick one in Servers</p>
          )}
        </div>
      </section>

      <div className="flex min-h-0 flex-col gap-5">
        {/* System proxy */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Windows System Proxy</p>
              <p className="text-xs text-muted-foreground">Independent of the Xray tunnel</p>
            </div>
            <Switch checked={s.systemProxy} onCheckedChange={(v) => getBridge().setSystemProxy(v)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5" /> System proxy</div>
              <p className={cn("mt-1 font-mono text-sm", s.systemProxy ? "text-success" : "text-muted-foreground")}>
                {s.systemProxy ? `127.0.0.1:${s.settings.httpPort}` : "Direct"}
              </p>
            </div>
            <div className="rounded-lg border bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Xray tunnel</div>
              <p className={cn("mt-1 font-mono text-sm", on ? "text-success" : "text-muted-foreground")}>{on ? "Active" : "Stopped"}</p>
            </div>
          </div>
          {s.systemProxy && !on && (
            <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">Proxy is set but the tunnel is down — traffic will fail.</p>
          )}
        </section>

        {/* Speed */}
        <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Live Speed</p>
            <div className="flex gap-4 font-mono text-xs">
              <span className="flex items-center gap-1 text-success"><ArrowDown className="h-3.5 w-3.5" />{fmtBytes(last?.down ?? 0, true)}</span>
              <span className="flex items-center gap-1 text-primary"><ArrowUp className="h-3.5 w-3.5" />{fmtBytes(last?.up ?? 0, true)}</span>
            </div>
          </div>
          <div className="mt-3 min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={() => ""}
                  formatter={(v: number, n) => [fmtBytes(v, true), n === "down" ? "Download" : "Upload"]}
                />
                <Area type="monotone" dataKey="down" stroke="var(--chart-1)" fill="url(#gd)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="up" stroke="var(--chart-2)" fill="url(#gu)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border bg-background/40 p-3">
              <p className="text-muted-foreground">Session download</p>
              <p className="font-mono text-base">{fmtBytes(last?.totalDown ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-background/40 p-3">
              <p className="text-muted-foreground">Session upload</p>
              <p className="font-mono text-base">{fmtBytes(last?.totalUp ?? 0)}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
