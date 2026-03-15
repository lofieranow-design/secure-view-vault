import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Eye, Clock, AlertCircle, Loader2, LogOut, FileText, Image, Video, FileSpreadsheet, ArrowLeft, Shield } from "lucide-react";
import logo from "@/assets/logo.png";
import { SectionNav } from "@/components/SectionNav";
import { SecureViewer } from "@/components/SecureViewer";

type ViewerState = "entry" | "verified" | "gallery" | "viewing" | "expired" | "error";

interface CodeData {
  id: string;
  code: string;
  timer_duration: number;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
}

interface LinkedFile {
  id: string;
  filename: string;
  filetype: string;
  storage_path: string;
  thumbnail_path: string | null;
  thumbnail_url: string | null;
}

export default function ViewerPage() {
  const [state, setState] = useState<ViewerState>("entry");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeData, setCodeData] = useState<CodeData | null>(null);
  const [files, setFiles] = useState<LinkedFile[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [fileTimers, setFileTimers] = useState<Record<string, number>>({});
  const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<LinkedFile | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const verifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-code", { body: { code: code.trim() } });
      if (fnError || !data?.valid) { setError(data?.message || "Invalid or expired code"); setState("error"); }
      else {
        setCodeData(data.codeData);
        setFiles(data.files);
        if (data.codeData.activated_at) {
          setSessionToken(data.sessionToken || "");
          const remaining = Math.max(0, Math.floor((new Date(data.codeData.expires_at).getTime() - Date.now()) / 1000));
          setState(remaining <= 0 ? "expired" : "gallery");
        } else setState("verified");
      }
    } catch { setError("Network error. Please try again."); setState("error"); }
    setLoading(false);
  };

  const activateViewing = async () => {
    if (!codeData) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("activate-session", { body: { code: codeData.code } });
      if (fnError || !data?.success) { setError(data?.message || "Failed to activate"); setState("error"); }
      else { setSessionToken(data.sessionToken); setState("gallery"); }
    } catch { setError("Network error."); setState("error"); }
    setLoading(false);
  };

  useEffect(() => {
    if (state !== "viewing" || !activeFile) return;
    timerRef.current = setInterval(() => {
      setFileTimers((prev) => {
        const current = prev[activeFile.id] ?? 0;
        if (current <= 1) { clearInterval(timerRef.current); setActiveFile(null); setState("gallery"); return { ...prev, [activeFile.id]: 0 }; }
        return { ...prev, [activeFile.id]: current - 1 };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state, activeFile]);

  useEffect(() => {
    if (state !== "gallery" || files.length === 0) return;
    if (files.every((f) => openedFiles.has(f.id)) && files.every((f) => { const t = fileTimers[f.id]; return t !== undefined && t <= 0; })) {
      setState("expired");
      supabase.functions.invoke("kill-session", { body: { sessionToken } }).catch(() => {});
    }
  }, [state, files, openedFiles, fileTimers, sessionToken]);

  const openFile = (file: LinkedFile) => {
    if (!openedFiles.has(file.id)) {
      setFileTimers((prev) => ({ ...prev, [file.id]: (codeData?.timer_duration ?? 1) * 60 }));
      setOpenedFiles((prev) => new Set(prev).add(file.id));
    }
    if (fileTimers[file.id] !== undefined && fileTimers[file.id] <= 0) return;
    setActiveFile(file);
    setState("viewing");
  };

  const backToGallery = () => { clearInterval(timerRef.current); setActiveFile(null); setState("gallery"); };

  const killSession = async () => {
    setLoading(true);
    try { await supabase.functions.invoke("kill-session", { body: { sessionToken } }); } catch {}
    clearInterval(timerRef.current);
    setState("expired");
    setLoading(false);
  };

  useEffect(() => {
    if (state !== "viewing") return;
    const prevent = (e: Event) => { e.preventDefault(); return false; };
    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === "s" || e.key === "p" || e.key === "c")) || (e.ctrlKey && e.shiftKey && e.key === "I") || e.key === "F12" || e.key === "PrintScreen") { e.preventDefault(); return false; }
    };
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("keydown", preventKeys);
    document.addEventListener("selectstart", prevent);
    return () => { document.removeEventListener("contextmenu", prevent); document.removeEventListener("keydown", preventKeys); document.removeEventListener("selectstart", prevent); };
  }, [state]);

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-6 w-6" />;
    if (type.startsWith("image/")) return <Image className="h-6 w-6" />;
    if (type.startsWith("video/")) return <Video className="h-6 w-6" />;
    return <FileSpreadsheet className="h-6 w-6" />;
  };

  // Entry / Verified / Error / Expired
  if (state === "entry" || state === "error" || state === "verified" || state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <SectionNav />
            </div>

            <div className="mb-6 flex flex-col items-center">
              <img src={logo} alt="DigitalPro" className="h-10 w-10 rounded-lg object-contain" />
              <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">DigitalPro</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter your access code to preview content</p>
            </div>

            <div className="space-y-3">
              {state === "expired" && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in">
                  <Clock className="h-4 w-4 shrink-0" />
                  Your access has expired.
                </div>
              )}
              {error && state === "error" && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {(state === "entry" || state === "error") && (
                <>
                  <Input
                    placeholder="Enter access code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-9 font-mono text-center text-sm tracking-wider"
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                  />
                  <Button onClick={verifyCode} className="w-full h-9 text-[13px] gradient-gold text-primary-foreground border-0 hover:opacity-90" disabled={loading || !code.trim()}>
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
                    Verify Code
                  </Button>
                </>
              )}

              {state === "verified" && codeData && (
                <div className="space-y-3 animate-fade-in">
                  <div className="rounded-md bg-success/10 p-4 text-center">
                    <Shield className="mx-auto h-5 w-5 text-success" />
                    <p className="mt-1.5 text-sm font-medium text-success">Code verified</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {files.length} file(s) · {formatTime(codeData.timer_duration * 60)} per file
                    </p>
                  </div>
                  <Button onClick={activateViewing} className="w-full h-9 text-[13px] gradient-gold text-primary-foreground border-0 hover:opacity-90" disabled={loading}>
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                    Browse Content
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">Each file has its own timer</p>
                </div>
              )}

              {state === "expired" && (
                <Button onClick={() => { setState("entry"); setCode(""); setError(""); }} variant="outline" className="w-full h-9 text-[13px]">
                  Enter Another Code
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Protected by DigitalPro</p>
        </div>
      </div>
    );
  }

  // Gallery
  if (state === "gallery") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-background/95 glass px-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="DigitalPro" className="h-6 w-6 rounded-md object-contain" />
            <span className="text-sm font-medium text-foreground">DigitalPro</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{openedFiles.size}/{files.length}</Badge>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 text-[13px]" onClick={killSession} disabled={loading}>
              <LogOut className="mr-1 h-3.5 w-3.5" />
              End
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="mx-auto max-w-3xl animate-fade-in">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Select a file</h2>
              <p className="text-sm text-muted-foreground">Each file has its own countdown timer</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((file) => {
                const isOpened = openedFiles.has(file.id);
                const timerVal = fileTimers[file.id];
                const isExpired = timerVal !== undefined && timerVal <= 0;

                return (
                  <button
                    key={file.id}
                    onClick={() => openFile(file)}
                    disabled={isExpired}
                    className={`group relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors
                      ${isExpired ? "cursor-not-allowed border-border opacity-40" : "cursor-pointer border-border hover:bg-accent/50"}`}
                  >
                    <div className="flex h-20 w-full items-center justify-center rounded-md bg-muted/50 overflow-hidden">
                      {file.thumbnail_url ? (
                        <img src={file.thumbnail_url} alt={file.filename} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-muted-foreground/40">{getFileIcon(file.filetype)}</div>
                      )}
                    </div>
                    <p className="w-full truncate text-xs font-medium text-foreground">{file.filename}</p>
                    {isOpened ? (
                      <span className={`text-[10px] font-mono ${isExpired ? "text-muted-foreground" : "text-primary"}`}>
                        {isExpired ? "Expired" : formatTime(timerVal ?? 0)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Not opened</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Viewing
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-background/95 glass px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={backToGallery} className="text-[13px]">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-[13px] font-medium text-foreground truncate max-w-[200px]">{activeFile?.filename}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeFile && (
            <Badge variant="outline" className={`font-mono text-xs ${(fileTimers[activeFile.id] ?? 0) <= 60 ? "animate-pulse-slow text-destructive border-destructive/30" : ""}`}>
              <Clock className="mr-1 h-3 w-3" />
              {formatTime(fileTimers[activeFile.id] ?? 0)}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 text-[13px]" onClick={killSession} disabled={loading}>
            <LogOut className="mr-1 h-3.5 w-3.5" />
            End
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="mx-auto max-w-5xl animate-fade-in">
          {activeFile && <SecureViewer file={activeFile} sessionToken={sessionToken} accessCode={codeData?.code || ""} />}
        </div>
      </main>
    </div>
  );
}
