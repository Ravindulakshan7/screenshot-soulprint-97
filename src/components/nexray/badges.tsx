import type { Profile } from "@/lib/nexray-bridge";
import { cn } from "@/lib/utils";

export function ProtoBadge({ p }: { p: Profile }) {
  const label = { vless: "VLESS", vmess: "VMess", trojan: "Trojan" }[p.protocol];
  return (
    <div className="flex items-center gap-1">
      <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{label}</span>
      {p.security && p.security !== "none" && (
        <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-success">{p.security}</span>
      )}
      {p.transport && p.transport !== "tcp" && (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">{p.transport}</span>
      )}
    </div>
  );
}

export function LatencyBadge({ v, label, loading }: { v?: number | null | undefined; label: string; loading?: boolean | undefined }) {
  const tone =
    loading ? "text-primary" :
    v === undefined ? "text-muted-foreground" :
    v === null ? "text-destructive" :
    v < 150 ? "text-success" : v < 350 ? "text-warning" : "text-destructive";
  return (
    <span className={cn("rounded-md border bg-background/40 px-2 py-0.5 font-mono text-[11px] tabular-nums", tone)}>
      {label} {loading ? "…" : v === undefined ? "—" : v === null ? "timeout" : `${v}ms`}
    </span>
  );
}
