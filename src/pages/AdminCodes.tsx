import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Plus, Ban, Copy, Link, Skull } from "lucide-react";
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

interface FileRecord {
  id: string;
  filename: string;
  filetype: string;
}

interface CodeFileMapping {
  code_id: string;
  file_id: string;
}

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
    // minutes stays as-is

    const { error } = await supabase.from("access_codes").insert({
      code,
      timer_duration: mins,
      created_by: user?.id,
    });

    if (error) {
      toast.error("Failed to generate code");
    } else {
      toast.success("Code generated");
      await navigator.clipboard.writeText(code);
      toast.info("Code copied to clipboard");
    }
    setGenerating(false);
    fetchData();
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("access_codes").update({ status: "revoked" }).eq("id", id);
    toast.success("Code revoked");
    fetchData();
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const openLinkDialog = (code: AccessCode) => {
    const linked = mappings.filter((m) => m.code_id === code.id).map((m) => m.file_id);
    setSelectedFiles(linked);
    setLinkDialogCode(code);
  };

  const saveFileLinks = async () => {
    if (!linkDialogCode) return;
    // Remove existing mappings
    await supabase.from("code_file_mappings").delete().eq("code_id", linkDialogCode.id);
    // Insert new
    if (selectedFiles.length > 0) {
      const inserts = selectedFiles.map((file_id) => ({
        code_id: linkDialogCode.id,
        file_id,
      }));
      await supabase.from("code_file_mappings").insert(inserts);
    }
    toast.success("File links updated");
    setLinkDialogCode(null);
    fetchData();
  };

  const getLinkedFileCount = (codeId: string) =>
    mappings.filter((m) => m.code_id === codeId).length;

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-success text-success-foreground">Active</Badge>;
    if (status === "revoked") return <Badge variant="destructive">Revoked</Badge>;
    return <Badge variant="secondary">Expired</Badge>;
  };

  const formatDuration = (mins: number) => {
    if (mins >= 1440) return `${Math.floor(mins / 1440)}d`;
    if (mins >= 60) return `${Math.floor(mins / 60)}h`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Access Codes</h1>
      </div>

      {/* Generate Code Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" /> Generate New Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Timer Duration</Label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as "seconds" | "minutes")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <KeyRound className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate Code"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No codes generated yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timer</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {code.code.slice(0, 8)}…
                      </code>
                    </TableCell>
                    <TableCell>{statusBadge(code.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(code.timer_duration)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getLinkedFileCount(code.id)} files</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(code.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(code.code)} title="Copy code">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Dialog open={linkDialogCode?.id === code.id} onOpenChange={(open) => !open && setLinkDialogCode(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openLinkDialog(code)} title="Link files">
                              <Link className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Link Files to Code</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 max-h-[400px] overflow-auto">
                              {files.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No files uploaded yet</p>
                              ) : (
                                files.map((f) => (
                                  <label key={f.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                                    <Checkbox
                                      checked={selectedFiles.includes(f.id)}
                                      onCheckedChange={(checked) => {
                                        setSelectedFiles((prev) =>
                                          checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                                        );
                                      }}
                                    />
                                    <span className="text-sm">{f.filename}</span>
                                  </label>
                                ))
                              )}
                            </div>
                            <Button onClick={saveFileLinks} className="w-full mt-4">
                              Save Links
                            </Button>
                          </DialogContent>
                        </Dialog>
                        {code.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevoke(code.id)}
                            title="Revoke"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
