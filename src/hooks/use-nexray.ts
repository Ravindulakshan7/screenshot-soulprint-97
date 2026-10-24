import { useEffect, useState, useSyncExternalStore } from "react";
import { getBridge, type LogEntry, type Telemetry } from "@/lib/nexray-bridge";

export function useNexray() {
  const b = getBridge();
  return useSyncExternalStore(b.subscribe, b.getState, b.getState);
}

export function useTelemetry(windowSize = 60) {
  const [series, setSeries] = useState<Telemetry[]>([]);
  useEffect(() => getBridge().onTelemetry((t) => setSeries((s) => [...s.slice(-(windowSize - 1)), t])), [windowSize]);
  return series;
}

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    const b = getBridge();
    setLogs(b.getLogs());
    return b.onLog(() => setLogs([...b.getLogs()]));
  }, []);
  const clear = () => { getBridge().clearLogs(); setLogs([]); };
  return { logs, clear };
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(Date.now()); const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return n;
}
