import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, KeyRound, Eye, Clock, AlertCircle, Loader2 } from "lucide-react";
import { SectionNav } from "@/components/SectionNav";
import { SecureViewer } from "@/components/SecureViewer";

type ViewerState = "entry" | "verified" | "viewing" | "expired" | "error";

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
}

export default function ViewerPage() {
  const [state, setState] = useState<ViewerState>("entry");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeData, setCodeData] = useState<CodeData | null>(null);
  const [files, setFiles] = useState<LinkedFile[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [sessionToken, setSessionToken] = useState<string>("");
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
          // Already activated — resume session
          setSessionToken(data.sessionToken || "");
          const expiresAt = new Date(data.codeData.expires_at).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          if (remaining <= 0) {
            setState("expired");
          } else {
            setTimeLeft(remaining);
            setState("viewing");
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
        setTimeLeft(codeData.timer_duration * 60);
        setState("viewing");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
    setLoading(false);
  };

  // Timer countdown
  useEffect(() => {
    if (state !== "viewing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setState("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state]);

  // Content protection
  useEffect(() => {
    if (state !== "viewing") return;

    const preventActions = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "p" || e.key === "c")) ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        return false;
      }
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

  // Entry / Verified / Error states
  if (state !== "viewing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="text-center space-y-4 pb-2">
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
                    {files.length} file(s) available • Access for {formatTime(codeData.timer_duration * 60)}
                  </p>
                </div>
                <Button onClick={activateViewing} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  View Content
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Timer starts when you click "View Content"
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

  // Viewing state
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">Digital Vault</span>
        </div>
        <div className="flex items-center gap-4">
          <Badge
            variant="outline"
            className={`font-mono text-sm ${timeLeft <= 60 ? "animate-pulse-slow border-destructive text-destructive" : ""}`}
          >
            <Clock className="mr-1 h-3 w-3" />
            {formatTime(timeLeft)}
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {files.map((file) => (
            <SecureViewer
              key={file.id}
              file={file}
              sessionToken={sessionToken}
              accessCode={codeData?.code || ""}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
