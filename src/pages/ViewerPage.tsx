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
  const [sessionToken, setSessionToken] = useState<string>("");
  const [fileTimers, setFileTimers] = useState<Record<string, number>>({});
  const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<LinkedFile | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const verifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-code", {
        body: { code: code.trim() },
      });
      if (fnError || !data?.valid) {
        setError(data?.message || "Invalid or expired code");
        setState("error");
      } else {
        setCodeData(data.codeData);
        setFiles(data.files);
        if (data.codeData.activated_at) {
          setSessionToken(data.sessionToken || "");
          const expiresAt = new Date(data.codeData.expires_at).getTime();
          const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          if (remaining <= 0) setState("expired");
          else setState("gallery");
        } else {
          setState("verified");
        }
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
    setLoading(false);
  };

  const activateViewing = async () => {
    if (!codeData) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("activate-session", {
        body: { code: codeData.code },
      });
      if (fnError || !data?.success) {
        setError(data?.message || "Failed to activate session");
        setState("error");
      } else {
        setSessionToken(data.sessionToken);
        setState("gallery");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (state !== "viewing" || !activeFile) return;
    timerRef.current = setInterval(() => {
      setFileTimers((prev) => {
        const current = prev[activeFile.id] ?? 0;
        if (current <= 1) {
          clearInterval(timerRef.current);
          setActiveFile(null);
          setState("gallery");
          return { ...prev, [activeFile.id]: 0 };
        }
        return { ...prev, [activeFile.id]: current - 1 };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state, activeFile]);

  useEffect(() => {
    if (state !== "gallery" || files.length === 0) return;
    const allOpened = files.every((f) => openedFiles.has(f.id));
    const allExpired = files.every((f) => {
      const timer = fileTimers[f.id];
      return timer !== undefined && timer <= 0;
    });
    if (allOpened && allExpired) {
      setState("expired");
      supabase.functions.invoke("kill-session", { body: { sessionToken } }).catch(() => {});
    }
  }, [state, files, openedFiles, fileTimers, sessionToken]);

  const openFile = (file: LinkedFile) => {
    if (!openedFiles.has(file.id)) {
      const timerSeconds = (codeData?.timer_duration ?? 1) * 60;
      setFileTimers((prev) => ({ ...prev, [file.id]: timerSeconds }));
      setOpenedFiles((prev) => new Set(prev).add(file.id));
    }
    if (fileTimers[file.id] !== undefined && fileTimers[file.id] <= 0) return;
    setActiveFile(file);
    setState("viewing");
  };

  const backToGallery = () => {
    clearInterval(timerRef.current);
    setActiveFile(null);
    setState("gallery");
  };

  const killSession = async () => {
    setLoading(true);
    try { await supabase.functions.invoke("kill-session", { body: { sessionToken } }); } catch {}
    clearInterval(timerRef.current);
    setState("expired");
    setLoading(false);
  };

  useEffect(() => {
    if (state !== "viewing") return;
    const preventActions = (e: Event) => { e.preventDefault(); return false; };
    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "p" || e.key === "c")) ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        e.key === "F12" || e.key === "PrintScreen"
      ) { e.preventDefault(); return false; }
    };
    document.addEventListener("contextmenu", preventActions);
    document.addEventListener("keydown", preventKeys);
    document.addEventListener("selectstart", preventActions);
    return () => {
      document.removeEventListener("contextmenu", preventActions);
      document.removeEventListener("keydown", preventKeys);
      document.removeEventListener("selectstart", preventActions);
    };
  }, [state]);

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-8 w-8" />;
    if (type.startsWith("image/")) return <Image className="h-8 w-8" />;
    if (type.startsWith("video/")) return <Video className="h-8 w-8" />;
    return <FileSpreadsheet className="h-8 w-8" />;
  };

  // Entry / Verified / Error / Expired states
  if (state === "entry" || state === "error" || state === "verified" || state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md animate-scale-in">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-xl shadow-primary/5">
            <div className="mb-6">
              <SectionNav />
            </div>

            <div className="mb-8 text-center">
              <a href="https://www.etsy.com/shop/ProDigitalHubUS?ref=profile_header" target="_blank" rel="noopener noreferrer" className="inline-block">
                <div className="relative mx-auto h-16 w-16">
                  <img src={logo} alt="DigitalPro" className="h-16 w-16 rounded-2xl object-contain transition-transform hover:scale-105" />
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent -z-10" />
                </div>
              </a>
              <h1 className="mt-4 font-display text-2xl text-foreground">DigitalPro</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your access code to preview content
              </p>
            </div>

            <div className="space-y-4">
              {state === "expired" && (
                <div className="flex items-center gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive animate-fade-in">
                  <Clock className="h-4 w-4 shrink-0" />
                  Your access has expired.
                </div>
              )}
              {error && state === "error" && (
                <div className="flex items-center gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive animate-fade-in">
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
                    className="font-mono text-center tracking-wider rounded-xl h-12"
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                  />
                  <Button onClick={verifyCode} className="w-full h-11 rounded-xl gradient-gold text-primary-foreground border-0 hover:opacity-90" disabled={loading || !code.trim()}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Verify Code
                  </Button>
                </>
              )}

              {state === "verified" && codeData && (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-xl bg-success/10 p-5 text-center">
                    <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-success" />
                    </div>
                    <p className="font-medium text-success">Code verified!</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {files.length} file(s) available • {formatTime(codeData.timer_duration * 60)} per file
                    </p>
                  </div>
                  <Button onClick={activateViewing} className="w-full h-11 rounded-xl gradient-gold text-primary-foreground border-0 hover:opacity-90" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    Browse Content
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Each file has its own timer that starts when you open it
                  </p>
                </div>
              )}

              {state === "expired" && (
                <Button onClick={() => { setState("entry"); setCode(""); setError(""); }} variant="outline" className="w-full h-11 rounded-xl">
                  Enter Another Code
                </Button>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground/50">
            Protected by DigitalPro • Secure Preview
          </p>
        </div>
      </div>
    );
  }

  // Gallery state
  if (state === "gallery") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 glass px-6">
          <div className="flex items-center gap-3">
            <a href="https://www.etsy.com/shop/ProDigitalHubUS?ref=profile_header" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <img src={logo} alt="DigitalPro" className="h-7 w-7 rounded-lg object-contain" />
              <span className="font-display text-sm text-foreground">DigitalPro</span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs rounded-lg">
              {openedFiles.size}/{files.length} opened
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={killSession}
              disabled={loading}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              End Session
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-4xl animate-fade-in">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl text-foreground">Select a file to preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">Each file has its own countdown timer</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {files.map((file) => {
                const isOpened = openedFiles.has(file.id);
                const timerVal = fileTimers[file.id];
                const isTimerExpired = timerVal !== undefined && timerVal <= 0;
                const thumbUrl = file.thumbnail_url || null;

                return (
                  <button
                    key={file.id}
                    onClick={() => openFile(file)}
                    disabled={isTimerExpired}
                    className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all duration-200
                      ${isTimerExpired
                        ? "cursor-not-allowed border-border bg-muted/50 opacity-50"
                        : "cursor-pointer border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
                      }`}
                  >
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/50">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={file.filename} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <div className="text-muted-foreground/40">{getFileIcon(file.filetype)}</div>
                      )}
                    </div>
                    <p className="w-full truncate text-xs font-medium text-foreground">{file.filename}</p>
                    {isOpened && (
                      <Badge
                        className={`text-[10px] rounded-lg ${isTimerExpired ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/20 border"}`}
                      >
                        {isTimerExpired ? "Expired" : (
                          <>
                            <Clock className="mr-0.5 h-2.5 w-2.5" />
                            {formatTime(timerVal ?? 0)}
                          </>
                        )}
                      </Badge>
                    )}
                    {!isOpened && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground rounded-lg">
                        Not opened
                      </Badge>
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

  // Viewing state
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 glass px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={backToGallery} className="rounded-lg">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <div className="h-5 w-px bg-border" />
          <a href="https://www.etsy.com/shop/ProDigitalHubUS?ref=profile_header" target="_blank" rel="noopener noreferrer">
            <img src={logo} alt="DigitalPro" className="h-6 w-6 rounded-lg object-contain transition-opacity hover:opacity-80" />
          </a>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {activeFile?.filename}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {activeFile && (
            <Badge
              className={`font-mono text-sm rounded-lg ${(fileTimers[activeFile.id] ?? 0) <= 60 ? "animate-pulse-slow bg-destructive/10 text-destructive border-destructive/20 border" : "bg-primary/10 text-primary border-primary/20 border"}`}
            >
              <Clock className="mr-1 h-3 w-3" />
              {formatTime(fileTimers[activeFile.id] ?? 0)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={killSession}
            disabled={loading}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            End
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-5xl animate-fade-in">
          {activeFile && (
            <SecureViewer
              file={activeFile}
              sessionToken={sessionToken}
              accessCode={codeData?.code || ""}
            />
          )}
        </div>
      </main>
    </div>
  );
}
