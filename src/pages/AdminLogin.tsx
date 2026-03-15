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
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-xl shadow-primary/5">
          {/* Nav */}
          <div className="mb-6">
            <SectionNav />
          </div>

          {/* Logo & Title */}
          <div className="mb-8 text-center">
            <a href="https://www.etsy.com/shop/ProDigitalHubUS?ref=profile_header" target="_blank" rel="noopener noreferrer" className="inline-block">
              <div className="relative mx-auto h-16 w-16">
                <img src={logo} alt="DigitalPro" className="h-16 w-16 rounded-2xl object-contain transition-transform hover:scale-105" />
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent -z-10" />
              </div>
            </a>
            <h1 className="mt-4 font-display text-2xl text-foreground">
              DigitalPro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin access only
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="rounded-xl h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl gradient-gold text-primary-foreground border-0 hover:opacity-90 font-medium" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground/50">
          Protected by DigitalPro • Secure Access
        </p>
      </div>
    </div>
  );
}
