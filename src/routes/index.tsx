import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Server, ScrollText, Settings, Minus, Square, X, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "@/components/nexray/Dashboard";
import { Servers } from "@/components/nexray/Servers";
import { Logs } from "@/components/nexray/Logs";
import { SettingsView } from "@/components/nexray/SettingsView";
import { useNexray } from "@/hooks/use-nexray";
import { getBridge } from "@/lib/nexray-bridge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexRay PC — V2Ray / Xray client for Windows" },
      { name: "description", content: "Dark-mode Windows desktop client for VLESS, VMess and Trojan with live speed graphs and system proxy control." },
      { property: "og:title", content: "NexRay PC — V2Ray / Xray client" },
      { property: "og:description", content: "Connect, test latency and manage VLESS, VMess and Trojan servers on Windows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const nav = [
  { k: "dashboard", l: "Dashboard", i: LayoutDashboard },
  { k: "servers", l: "Servers", i: Server },
  { k: "logs", l: "Logs", i: ScrollText },
  { k: "settings", l: "Settings", i: Settings },
] as const;
type View = (typeof nav)[number]["k"];

function App() {
  const [view, setView] = useState<View>("dashboard");
  const s = useNexray();
  const w = getBridge().window;
  const pill = s.conn === "Connected" ? "bg-success/15 text-success" : s.conn === "Disconnected" ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary";

  return (
    <div className="app-bg flex h-screen select-none flex-col overflow-hidden bg-background">
      <header className="drag flex h-10 shrink-0 items-center border-b bg-titlebar pl-4">
        <Zap className="h-4 w-4 text-primary" />
        <span className="ml-2 text-sm font-semibold tracking-wide">NexRay PC</span>
        <span className={cn("ml-3 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", pill)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />{s.conn}
        </span>
        <div className="no-drag ml-auto flex h-full">
          <button onClick={w.minimize} title="Minimize to tray" className="flex w-12 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"><Minus className="h-4 w-4" /></button>
          <button onClick={w.maximize} title="Maximize" className="flex w-12 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"><Square className="h-3.5 w-3.5" /></button>
          <button onClick={w.close} title="Close" className="flex w-12 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-20 shrink-0 flex-col items-center gap-2 border-r bg-titlebar/60 py-4">
          {nav.map(({ k, l, i: Icon }) => (
            <button key={k} onClick={() => setView(k)}
              className={cn("flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition-colors",
                view === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
              <Icon className="h-5 w-5" />{l}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          {view === "dashboard" && <Dashboard />}
          {view === "servers" && <Servers />}
          {view === "logs" && <Logs />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
