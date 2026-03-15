import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Plus, Ban, Copy, Link, Skull, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AccessCode {
  id: string;
  code: string;
  timer_duration: number;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface FileRecord { id: string; filename: string; filetype: string; }
interface CodeFileMapping { code_id: string; file_id: string; }

function generateSecureCode(length = 20): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export default function AdminCodes() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [mappings, setMappings] = useState<CodeFileMapping[]>([]);
  const [duration, setDuration] = useState("60");
  const [durationUnit, setDurationUnit] = useState<"seconds" | "minutes">("minutes");
  const [generating, setGenerating] = useState(false);
  const [linkDialogCode, setLinkDialogCode] = useState<AccessCode | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    const [codesRes, filesRes, mappingsRes] = await Promise.all([
      supabase.from("access_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("files").select("id, filename, filetype"),
      supabase.from("code_file_mappings").select("code_id, file_id"),
    ]);
    if (codesRes.data) setCodes(codesRes.data as AccessCode[]);
    if (filesRes.data) setFiles(filesRes.data as FileRecord[]);
    if (mappingsRes.data) setMappings(mappingsRes.data as CodeFileMapping[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    const code = generateSecureCode();
    let mins = parseInt(duration);
    if (durationUnit === "seconds") mins = Math.max(1, Math.round(mins / 60));

    navigator.clipboard.writeText(code).catch(() => {});
    toast.info("Code copied to clipboard");

    const { data, error } = await supabase.from("access_codes").insert({
      code, timer_duration: mins, created_by: user?.id,
    }).select().single();

    if (error) toast.error("Failed to generate code");
    else { toast.success("Code generated"); if (data) setCodes((prev) => [data as AccessCode, ...prev]); }
    setGenerating(false);
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("access_codes").update({ status: "revoked" }).eq("id", id);
    toast.success("Code revoked");
    fetchData();
  };

  const handleDeleteCode = async (id: string) => {
    await supabase.from("code_file_mappings").delete().eq("code_id", id);
    await supabase.from("viewer_sessions").delete().eq("code_id", id);
    await supabase.from("activity_log").delete().eq("code_id", id);
    await supabase.from("access_codes").delete().eq("id", id);
    toast.success("Code deleted");
    fetchData();
  };

  const handleKillSessions = async (codeId: string) => {
    await supabase.from("viewer_sessions").update({ is_active: false }).eq("code_id", codeId);
    await supabase.from("access_codes").update({ status: "expired" }).eq("id", codeId);
    toast.success("Sessions killed");
    fetchData();
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const openLinkDialog = (code: AccessCode) => {
    setSelectedFiles(mappings.filter((m) => m.code_id === code.id).map((m) => m.file_id));
    setLinkDialogCode(code);
  };

  const saveFileLinks = async () => {
    if (!linkDialogCode) return;
    await supabase.from("code_file_mappings").delete().eq("code_id", linkDialogCode.id);
    if (selectedFiles.length > 0) {
      await supabase.from("code_file_mappings").insert(
        selectedFiles.map((file_id) => ({ code_id: linkDialogCode.id, file_id }))
      );
    }
    toast.success("File links updated");
    setLinkDialogCode(null);
    fetchData();
  };

  const getLinkedFileCount = (codeId: string) => mappings.filter((m) => m.code_id === codeId).length;

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge variant="outline" className="text-success border-success/30 text-[11px]">Active</Badge>;
    if (status === "revoked") return <Badge variant="outline" className="text-destructive border-destructive/30 text-[11px]">Revoked</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[11px]">Expired</Badge>;
  };

  const formatDuration = (mins: number) => {
    if (mins >= 1440) return `${Math.floor(mins / 1440)}d`;
    if (mins >= 60) return `${Math.floor(mins / 60)}h`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Access Codes</h1>
        <p className="text-sm text-muted-foreground">Generate and manage preview access codes</p>
      </div>

      {/* Generate */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Generate New Code</h2>
        <p className="text-[13px] text-muted-foreground">Create a shareable access code for clients</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Duration</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-20 h-8 text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Unit</Label>
            <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as "seconds" | "minutes")}>
              <SelectTrigger className="w-24 h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Seconds</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="gradient-gold text-primary-foreground border-0 hover:opacity-90">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">All Codes</h2>
          <p className="text-xs text-muted-foreground">{codes.length} total</p>
        </div>
        {codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <KeyRound className="h-6 w-6 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No codes generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Code</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Timer</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Files</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Created</TableHead>
                  <TableHead className="w-[140px] text-[11px] uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id} className="hover:bg-accent/50 transition-colors">
                    <TableCell>
                      <code className="font-mono text-xs text-foreground">{code.code.slice(0, 10)}…</code>
                    </TableCell>
                    <TableCell>{statusBadge(code.status)}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground font-mono">{formatDuration(code.timer_duration)}</TableCell>
                    <TableCell>
                      <span className="text-[13px] text-muted-foreground">{getLinkedFileCount(code.id)} files</span>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{new Date(code.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(code.code)} title="Copy" className="h-7 w-7">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Dialog open={linkDialogCode?.id === code.id} onOpenChange={(open) => !open && setLinkDialogCode(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openLinkDialog(code)} title="Link files" className="h-7 w-7">
                              <Link className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Link Files to Code</DialogTitle></DialogHeader>
                            <div className="space-y-1 max-h-[400px] overflow-auto">
                              {files.length === 0 ? (
                                <p className="text-muted-foreground text-sm py-4 text-center">No files uploaded</p>
                              ) : files.map((f) => (
                                <label key={f.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent cursor-pointer transition-colors">
                                  <Checkbox
                                    checked={selectedFiles.includes(f.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedFiles((prev) => checked ? [...prev, f.id] : prev.filter((id) => id !== f.id));
                                    }}
                                  />
                                  <span className="text-[13px]">{f.filename}</span>
                                </label>
                              ))}
                            </div>
                            <Button onClick={saveFileLinks} size="sm" className="w-full mt-3 gradient-gold text-primary-foreground border-0">Save Links</Button>
                          </DialogContent>
                        </Dialog>
                        {code.status === "active" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleKillSessions(code.id)} title="Kill sessions">
                              <Skull className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleRevoke(code.id)} title="Revoke">
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCode(code.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
