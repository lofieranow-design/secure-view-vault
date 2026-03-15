import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { SectionNav } from "@/components/SectionNav";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !user) return;
    if (isAdmin) {
      navigate("/admin", { replace: true });
    } else {
      setError("This account is not authorized for admin access");
      setLoading(false);
    }
  }, [user, isAdmin, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError("Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <SectionNav />
          </div>

          <div className="mb-6 flex flex-col items-center">
            <img src={logo} alt="DigitalPro" className="h-10 w-10 rounded-lg object-contain" />
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              Sign in to DigitalPro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin access only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px]">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px]">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-9"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-9 text-[13px] font-medium gradient-gold text-primary-foreground border-0 hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-3.5 w-3.5" />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Protected by DigitalPro
        </p>
      </div>
    </div>
  );
}
