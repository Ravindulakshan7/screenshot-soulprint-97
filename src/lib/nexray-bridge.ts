// Typed bridge to the Electron main process (window.nexray).
// Falls back to a realistic in-browser mock when not running inside Electron.

export type Protocol = "vless" | "vmess" | "trojan";
export type ConnState = "Disconnected" | "Connecting" | "Connected" | "Disconnecting";
export type LogLevel = "info" | "warning" | "error";
export type LatencyType = "tcp" | "proxy";

export interface Profile {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  security?: "reality" | "tls" | "none";
  transport?: "tcp" | "ws" | "grpc";
  raw: string;
  tcpLatency?: number | null; // null = timeout
  proxyLatency?: number | null;
}

export interface ImportResult {
  added: Profile[];
  duplicates: number;
  invalid: number;
}

export interface Telemetry {
  up: number; // bytes/s
  down: number;
  totalUp: number;
  totalDown: number;
  t: number;
}

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  msg: string;
}

export interface Settings {
  httpPort: number;
  socksPort: number;
  autoStart: boolean;
  minimizeToTray: boolean;
}

export interface BridgeState {
  conn: ConnState;
  activeId: string | null;
  connectedAt: number | null;
  systemProxy: boolean;
  profiles: Profile[];
  settings: Settings;
  proxySnapshot: { savedAt: number; previous: string } | null;
}

export interface NexrayBridge {
  getState(): BridgeState;
  subscribe(fn: (s: BridgeState) => void): () => void;
  onTelemetry(fn: (t: Telemetry) => void): () => void;
  onLog(fn: (l: LogEntry) => void): () => void;
  getLogs(): LogEntry[];
  clearLogs(): void;
  importClipboard(text?: string): Promise<ImportResult>;
  removeProfile(id: string): void;
  renameProfile(id: string, name: string): void;
  selectProfile(id: string): void;
  connect(profileId: string): Promise<void>;
  disconnect(): Promise<void>;
  setSystemProxy(enabled: boolean): Promise<void>;
  testLatency(profileId: string, type: LatencyType): Promise<number | null>;
  updateSettings(p: Partial<Settings>): void;
  window: { minimize(): void; maximize(): void; close(): void };
}

declare global {
  interface Window {
    nexray?: NexrayBridge;
  }
}

/* ---------------- Link parsing ---------------- */

const uid = () => Math.random().toString(36).slice(2, 10);

function b64decode(s: string) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(norm + "===".slice((norm.length + 3) % 4));
}

export function parseLink(link: string): Profile | null {
  const raw = link.trim();
  try {
    if (raw.startsWith("vmess://")) {
      const j = JSON.parse(b64decode(raw.slice(8)));
      if (!j.add || !j.port) return null;
      return {
        id: uid(),
        name: j.ps || `${j.add}:${j.port}`,
        protocol: "vmess",
        host: j.add,
        port: Number(j.port),
        security: j.tls === "tls" ? "tls" : "none",
        transport: (j.net as Profile["transport"]) || "tcp",
        raw,
      };
    }
    if (raw.startsWith("vless://") || raw.startsWith("trojan://")) {
      const protocol = raw.startsWith("vless://") ? "vless" : "trojan";
      const u = new URL(raw.replace(/^(vless|trojan):\/\//, "http://"));
      if (!u.username || !u.hostname || !u.port) return null;
      const sec = u.searchParams.get("security");
      return {
        id: uid(),
        name: decodeURIComponent(u.hash.slice(1)) || `${u.hostname}:${u.port}`,
        protocol,
        host: u.hostname,
        port: Number(u.port),
        security: sec === "reality" ? "reality" : sec === "tls" || protocol === "trojan" ? "tls" : "none",
        transport: (u.searchParams.get("type") as Profile["transport"]) || "tcp",
        raw,
      };
    }
  } catch {
    return null;
  }
  return null;
}

const key = (p: Pick<Profile, "protocol" | "host" | "port">) => `${p.protocol}|${p.host}|${p.port}`;

export function parseMany(text: string, existing: Profile[]): ImportResult {
  const seen = new Set(existing.map(key));
  const res: ImportResult = { added: [], duplicates: 0, invalid: 0 };
  for (const line of text.split(/[\s\n]+/).filter(Boolean)) {
    const p = parseLink(line);
    if (!p) { res.invalid++; continue; }
    if (seen.has(key(p))) { res.duplicates++; continue; }
    seen.add(key(p));
    res.added.push(p);
  }
  return res;
}

/** Strip UUIDs / passwords from log lines. */
export function sanitize(msg: string) {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[REDACTED-UUID]")
    .replace(/(password|pass|id)=\S+/gi, "$1=[REDACTED]");
}

/* ---------------- Mock implementation ---------------- */

const seedProfiles: Profile[] = [
  { id: "p1", name: "Tokyo Reality 01", protocol: "vless", host: "jp1.nexray.net", port: 443, security: "reality", transport: "tcp", raw: "", tcpLatency: 82, proxyLatency: 164 },
  { id: "p2", name: "Frankfurt WS", protocol: "vmess", host: "de.nexray.net", port: 8443, security: "tls", transport: "ws", raw: "", tcpLatency: 141, proxyLatency: 290 },
  { id: "p3", name: "Singapore Trojan", protocol: "trojan", host: "sg.nexray.net", port: 443, security: "tls", transport: "tcp", raw: "", tcpLatency: 47, proxyLatency: 118 },
  { id: "p4", name: "US West gRPC", protocol: "vless", host: "us-w.nexray.net", port: 2053, security: "tls", transport: "grpc", raw: "" },
];

function createMock(): NexrayBridge {
  let state: BridgeState = {
    conn: "Disconnected",
    activeId: "p1",
    connectedAt: null,
    systemProxy: false,
    profiles: seedProfiles,
    settings: { httpPort: 10809, socksPort: 10808, autoStart: true, minimizeToTray: true },
    proxySnapshot: null,
  };
  const subs = new Set<(s: BridgeState) => void>();
  const tSubs = new Set<(t: Telemetry) => void>();
  const lSubs = new Set<(l: LogEntry) => void>();
  let logs: LogEntry[] = [];
  let logId = 0;
  let totals = { up: 0, down: 0 };

  const set = (p: Partial<BridgeState>) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };
  const log = (level: LogLevel, msg: string) => {
    const e = { id: ++logId, ts: Date.now(), level, msg: sanitize(msg) };
    logs = [...logs.slice(-499), e];
    lSubs.forEach((f) => f(e));
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const active = () => state.profiles.find((p) => p.id === state.activeId);

  log("info", "NexRay PC core initialised · Xray-core v25.3.6");
  log("info", `Inbound http 127.0.0.1:${state.settings.httpPort} · socks 127.0.0.1:${state.settings.socksPort} ready`);

  if (typeof window !== "undefined") {
    setInterval(() => {
      const on = state.conn === "Connected";
      const down = on ? Math.max(0, 1.2e6 + Math.sin(Date.now() / 3000) * 9e5 + Math.random() * 1.4e6) : 0;
      const up = on ? Math.max(0, 1.4e5 + Math.random() * 2.6e5) : 0;
      totals.up += up; totals.down += down;
      tSubs.forEach((f) => f({ up, down, totalUp: totals.up, totalDown: totals.down, t: Date.now() }));
      if (on && Math.random() < 0.35) {
        const hosts = ["www.google.com:443", "api.github.com:443", "cdn.discordapp.com:443", "i.ytimg.com:443", "id=8c1f2a3b-4d5e-6f70-8192-a3b4c5d6e7f8"];
        const r = Math.random();
        if (r < 0.08) log("error", `[Warning] failed to dial ${hosts[1]} > i/o timeout`);
        else if (r < 0.2) log("warning", `proxy/vless: connection reset, retrying user ${hosts[4]}`);
        else log("info", `[Info] accepted tcp:${hosts[Math.floor(Math.random() * 4)]} [proxy]`);
      }
    }, 1000);
  }

  return {
    getState: () => state,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    onTelemetry: (f) => { tSubs.add(f); return () => tSubs.delete(f); },
    onLog: (f) => { lSubs.add(f); return () => lSubs.delete(f); },
    getLogs: () => logs,
    clearLogs: () => { logs = []; },
    async importClipboard(text) {
      let src = text;
      if (src === undefined) {
        try { src = await navigator.clipboard.readText(); } catch { src = ""; }
      }
      const res = parseMany(src ?? "", state.profiles);
      if (res.added.length) set({ profiles: [...state.profiles, ...res.added] });
      log("info", `Import: ${res.added.length} added, ${res.duplicates} duplicates, ${res.invalid} invalid`);
      return res;
    },
    removeProfile(id) {
      set({ profiles: state.profiles.filter((p) => p.id !== id), activeId: state.activeId === id ? null : state.activeId });
    },
    renameProfile(id, name) {
      set({ profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)) });
    },
    selectProfile(id) { if (state.conn === "Disconnected") set({ activeId: id }); },
    async connect(id) {
      if (state.conn !== "Disconnected") return;
      set({ conn: "Connecting", activeId: id });
      const p = active();
      log("info", `Starting Xray-core → ${p?.name} (${p?.protocol.toUpperCase()} ${p?.security ?? ""})`);
      await wait(1600);
      totals = { up: 0, down: 0 };
      set({ conn: "Connected", connectedAt: Date.now() });
      log("info", "Tunnel established. Outbound handshake OK.");
    },
    async disconnect() {
      if (state.conn !== "Connected") return;
      set({ conn: "Disconnecting" });
      log("info", "Stopping Xray-core…");
      await wait(900);
      set({ conn: "Disconnected", connectedAt: null });
      log("info", "Xray-core stopped.");
    },
    async setSystemProxy(enabled) {
      await wait(250);
      set({
        systemProxy: enabled,
        proxySnapshot: enabled ? { savedAt: Date.now(), previous: "Direct (no proxy)" } : state.proxySnapshot,
      });
      log(enabled ? "info" : "warning", enabled ? `Windows system proxy set → 127.0.0.1:${state.settings.httpPort}` : "Windows system proxy restored to previous snapshot");
    },
    async testLatency(id, type) {
      const p = state.profiles.find((x) => x.id === id);
      if (!p) return null;
      await wait(300 + Math.random() * 900);
      const fail = Math.random() < 0.12;
      const base = 30 + Math.random() * 180;
      const v = fail ? null : Math.round(type === "tcp" ? base : base * 1.8 + 40);
      set({ profiles: state.profiles.map((x) => (x.id === id ? { ...x, [type === "tcp" ? "tcpLatency" : "proxyLatency"]: v } : x)) });
      return v;
    },
    updateSettings(p) {
      set({ settings: { ...state.settings, ...p } });
      log("info", `Settings updated: ${Object.keys(p).join(", ")}`);
    },
    window: {
      minimize: () => log("info", "Minimised to system tray"),
      maximize: () => {},
      close: () => log("info", state.settings.minimizeToTray ? "Close → minimised to tray" : "Exit requested"),
    },
  };
}

let instance: NexrayBridge | null = null;
export function getBridge(): NexrayBridge {
  if (instance) return instance;
  instance = (typeof window !== "undefined" && window.nexray) || createMock();
  return instance;
}

export function fmtBytes(b: number, perSec = false) {
  const s = perSec ? "/s" : "";
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB${s}`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB${s}`;
  return `${(b / 1e3).toFixed(1)} KB${s}`;
}
