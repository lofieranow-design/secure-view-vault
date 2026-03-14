import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, KeyRound, Eye, Clock, AlertCircle, Loader2, LogOut, FileText, Image, Video, FileSpreadsheet } from "lucide-react";
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

  // Per-file timers: fileId → seconds remaining
  const [fileTimers, setFileTimers] = useState<Record<string, number>>({});
  // Which files have been opened (timer started)
  const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());
  // Currently viewing file
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
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          if (remaining <= 0) {
            setState("expired");
          } else {
            setState("gallery");
          }
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

  // Per-file timer: ticks down active file's timer
  useEffect(() => {
    if (state !== "viewing" || !activeFile) return;
    timerRef.current = setInterval(() => {
      setFileTimers((prev) => {
        const current = prev[activeFile.id] ?? 0;
        if (current <= 1) {
          clearInterval(timerRef.current);
          // File timer expired, go back to gallery
          setActiveFile(null);
          setState("gallery");
          return { ...prev, [activeFile.id]: 0 };
        }
        return { ...prev, [activeFile.id]: current - 1 };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state, activeFile]);

  // Check if all files have been opened and their timers expired → code is dead
  useEffect(() => {
    if (state !== "gallery" || files.length === 0) return;
    const allOpened = files.every((f) => openedFiles.has(f.id));
    const allExpired = files.every((f) => {
      const timer = fileTimers[f.id];
      return timer !== undefined && timer <= 0;
    });
    if (allOpened && allExpired) {
      setState("expired");
      // Kill the session
      supabase.functions.invoke("kill-session", { body: { sessionToken } }).catch(() => {});
    }
  }, [state, files, openedFiles, fileTimers, sessionToken]);

  const openFile = (file: LinkedFile) => {
    if (!openedFiles.has(file.id)) {
      // First open: set timer
      const timerSeconds = (codeData?.timer_duration ?? 1) * 60;
      setFileTimers((prev) => ({ ...prev, [file.id]: timerSeconds }));
      setOpenedFiles((prev) => new Set(prev).add(file.id));
    }
    // If timer already expired for this file, don't allow reopening
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
    try {
      await supabase.functions.invoke("kill-session", { body: { sessionToken } });
    } catch {}
    clearInterval(timerRef.current);
    setState("expired");
    setLoading(false);
  };

  // Content protection
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


  // Entry / Verified / Error states
  if (state === "entry" || state === "error" || state === "verified" || state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="text-center space-y-4 pb-2">
            <SectionNav />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl font-bold text-foreground">
              Digital Vault
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your access code to view protected content
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "expired" && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <Clock className="h-4 w-4 shrink-0" />
                Your access has expired.
              </div>
            )}
            {error && state === "error" && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {(state === "entry" || state === "error") && (
              <>
                <div className="space-y-2">
                  <Input
                    placeholder="Enter access code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono text-center tracking-wider"
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                  />
                </div>
                <Button onClick={verifyCode} className="w-full" disabled={loading || !code.trim()}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Verify Code
                </Button>
              </>
            )}

            {state === "verified" && codeData && (
              <div className="space-y-4">
                <div className="rounded-md bg-success/10 p-4 text-center">
                  <p className="font-medium text-success">Code verified!</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {files.length} file(s) available • {formatTime(codeData.timer_duration * 60)} per file
                  </p>
                </div>
                <Button onClick={activateViewing} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  Browse Content
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Each file has its own timer that starts when you open it
                </p>
              </div>
            )}

            {state === "expired" && (
              <Button onClick={() => { setState("entry"); setCode(""); setError(""); }} variant="outline" className="w-full">
                Enter Another Code
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gallery state — thumbnail grid
  if (state === "gallery") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold text-foreground">Digital Vault</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs">
              {openedFiles.size}/{files.length} opened
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={killSession}
              disabled={loading}
            >
              <LogOut className="mr-1 h-3.5 w-3.5" />
              End Session
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-center font-display text-xl font-bold text-foreground">
              Select a file to view
            </h2>
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
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all
                      ${isTimerExpired
                        ? "cursor-not-allowed border-border bg-muted opacity-50"
                        : "cursor-pointer border-border bg-card hover:border-primary hover:shadow-md"
                      }`}
                  >
                    {/* Thumbnail or icon */}
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={file.filename} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-muted-foreground">{getFileIcon(file.filetype)}</div>
                      )}
                    </div>

                    {/* Filename */}
                    <p className="w-full truncate text-xs font-medium text-foreground">{file.filename}</p>

                    {/* Timer status */}
                    {isOpened && (
                      <Badge
                        variant={isTimerExpired ? "secondary" : "outline"}
                        className="font-mono text-[10px]"
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
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
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

  // Viewing state — single file
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={backToGallery}>
            ← Back
          </Button>
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">
            {activeFile?.filename}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {activeFile && (
            <Badge
              variant="outline"
              className={`font-mono text-sm ${(fileTimers[activeFile.id] ?? 0) <= 60 ? "animate-pulse-slow border-destructive text-destructive" : ""}`}
            >
              <Clock className="mr-1 h-3 w-3" />
              {formatTime(fileTimers[activeFile.id] ?? 0)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={killSession}
            disabled={loading}
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            End Session
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
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
