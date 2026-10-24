import type { ReactNode } from "react";
import { History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNexray } from "@/hooks/use-nexray";
import { getBridge } from "@/lib/nexray-bridge";

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b px-5 py-4 last:border-0">
      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      {children}
    </div>
  );
}

function PortInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 font-mono text-sm">
      <span className="text-muted-foreground">127.0.0.1:</span>
      <Input type="number" defaultValue={value} min={1024} max={65535} className="h-8 w-24 font-mono"
        onBlur={(e) => { const n = Number(e.target.value); if (n >= 1024 && n <= 65535 && n !== value) onCommit(n); }} />
    </div>
  );
}

export function SettingsView() {
  const s = useNexray();
  const b = getBridge();
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inbounds</h3>
        <section className="glass rounded-2xl">
          <Row title="HTTP inbound" desc="Used by the Windows system proxy"><PortInput value={s.settings.httpPort} onCommit={(n) => b.updateSettings({ httpPort: n })} /></Row>
          <Row title="SOCKS5 inbound" desc="For apps with manual SOCKS configuration"><PortInput value={s.settings.socksPort} onCommit={(n) => b.updateSettings({ socksPort: n })} /></Row>
        </section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Behaviour</h3>
        <section className="glass rounded-2xl">
          <Row title="Start with Windows" desc="Launch NexRay PC when you sign in"><Switch checked={s.settings.autoStart} onCheckedChange={(v) => b.updateSettings({ autoStart: v })} /></Row>
          <Row title="Minimize to tray on close" desc="Keep the tunnel running in the background"><Switch checked={s.settings.minimizeToTray} onCheckedChange={(v) => b.updateSettings({ minimizeToTray: v })} /></Row>
        </section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crash recovery</h3>
        <section className="glass flex items-start gap-4 rounded-2xl p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><History className="h-5 w-5" /></div>
          <div className="text-sm">
            <p className="font-medium">Proxy snapshot {s.proxySnapshot ? <span className="text-success">saved</span> : <span className="text-muted-foreground">none</span>}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.proxySnapshot
                ? `Captured ${new Date(s.proxySnapshot.savedAt).toLocaleString()} · previous setting: ${s.proxySnapshot.previous}. Restored automatically if NexRay exits unexpectedly.`
                : "A snapshot of your Windows proxy settings is taken before NexRay changes them, so they can be restored after a crash."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
