import { useMemo, useState } from "react";
import { ClipboardPaste, FileText, Search, Gauge, ChevronDown, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNexray } from "@/hooks/use-nexray";
import { getBridge, type ImportResult, type LatencyType, type Profile } from "@/lib/nexray-bridge";
import { cn } from "@/lib/utils";
import { LatencyBadge, ProtoBadge } from "./badges";

function report(r: ImportResult) {
  if (r.added.length) toast.success(`Imported ${r.added.length} server${r.added.length > 1 ? "s" : ""}`, { description: `${r.duplicates} duplicates · ${r.invalid} invalid skipped` });
  else toast.error("Nothing imported", { description: `${r.duplicates} duplicates · ${r.invalid} invalid links` });
}

export function Servers() {
  const s = useNexray();
  const [q, setQ] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [edit, setEdit] = useState<Profile | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const list = useMemo(
    () => s.profiles.filter((p) => `${p.name} ${p.host} ${p.protocol}`.toLowerCase().includes(q.toLowerCase())),
    [s.profiles, q],
  );

  const testAll = async (type: LatencyType) => {
    const b = getBridge();
    await Promise.all(list.map(async (p) => {
      const k = `${p.id}:${type}`;
      setTesting((t) => ({ ...t, [k]: true }));
      await b.testLatency(p.id, type);
      setTesting((t) => ({ ...t, [k]: false }));
    }));
    toast.success(`${type === "tcp" ? "TCP ping" : "Proxy test"} finished for ${list.length} servers`);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center gap-3">
        <Button onClick={async () => report(await getBridge().importClipboard())}>
          <ClipboardPaste /> Import from Clipboard
        </Button>
        <Button variant="secondary" onClick={() => setPasteOpen(true)}><FileText /> Paste links</Button>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search servers" className="pl-9" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary"><Gauge /> Test All Latency <ChevronDown /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => testAll("tcp")}>TCP Ping</DropdownMenuItem>
            <DropdownMenuItem onClick={() => testAll("proxy")}>Proxy Request Test</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="glass mt-5 min-h-0 flex-1 overflow-y-auto rounded-2xl">
        <div className="sticky top-0 grid grid-cols-[24px_1.6fr_1.3fr_1.4fr_1fr_72px] gap-3 border-b bg-popover/90 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
          <span /> <span>Name</span> <span>Protocol</span> <span>Host:Port</span> <span>Latency</span> <span />
        </div>
        {list.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No servers. Import some links to get started.</p>}
        {list.map((p) => {
          const active = p.id === s.activeId;
          return (
            <div
              key={p.id}
              onClick={() => getBridge().selectProfile(p.id)}
              className={cn(
                "grid cursor-pointer grid-cols-[24px_1.6fr_1.3fr_1.4fr_1fr_72px] items-center gap-3 border-b px-4 py-3 text-sm transition-colors last:border-0 hover:bg-accent/40",
                active && "bg-primary/10",
              )}
            >
              {active ? <CheckCircle2 className={cn("h-4 w-4", s.conn === "Connected" ? "text-success" : "text-primary")} /> : <span />}
              <span className="truncate font-medium">{p.name}</span>
              <ProtoBadge p={p} />
              <span className="truncate font-mono text-xs text-muted-foreground">{p.host}:{p.port}</span>
              <div className="flex flex-col gap-1">
                <LatencyBadge label="TCP" v={p.tcpLatency} loading={testing[`${p.id}:tcp`]} />
                <LatencyBadge label="PRX" v={p.proxyLatency} loading={testing[`${p.id}:proxy`]} />
              </div>
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(p)} aria-label="Edit"><Pencil /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" aria-label="Delete"
                  disabled={active && s.conn !== "Disconnected"}
                  onClick={() => { getBridge().removeProfile(p.id); toast(`Removed ${p.name}`); }}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste share links</DialogTitle>
            <DialogDescription>One or more vless://, vmess:// or trojan:// links, separated by new lines.</DialogDescription>
          </DialogHeader>
          <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={7} className="font-mono text-xs"
            placeholder="vless://uuid@host:443?security=reality&type=tcp#My%20Server" />
          <DialogFooter>
            <Button onClick={async () => { report(await getBridge().importClipboard(paste)); setPaste(""); setPasteOpen(false); }}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit server</DialogTitle></DialogHeader>
          <Input value={edit?.name ?? ""} onChange={(e) => edit && setEdit({ ...edit, name: e.target.value })} />
          <DialogFooter>
            <Button onClick={() => { if (edit) getBridge().renameProfile(edit.id, edit.name); setEdit(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
