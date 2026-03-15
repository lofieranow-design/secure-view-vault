import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, KeyRound, Eye, Zap, TrendingUp, ArrowUpRight } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ files: 0, codes: 0, activeCodes: 0, sessions: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [filesRes, codesRes, activeRes, sessionsRes] = await Promise.all([
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("access_codes").select("id", { count: "exact", head: true }),
        supabase.from("access_codes").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("viewer_sessions").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      setStats({
        files: filesRes.count ?? 0,
        codes: codesRes.count ?? 0,
        activeCodes: activeRes.count ?? 0,
        sessions: sessionsRes.count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    {
      label: "Total Files",
      value: stats.files,
      icon: FolderOpen,
      description: "Digital products uploaded",
      gradient: "from-blue-500/10 to-blue-600/5",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      label: "Generated Codes",
      value: stats.codes,
      icon: KeyRound,
      description: "Access codes created",
      gradient: "from-primary/10 to-primary/5",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Active Codes",
      value: stats.activeCodes,
      icon: Zap,
      description: "Currently active",
      gradient: "from-success/10 to-success/5",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "Active Sessions",
      value: stats.sessions,
      icon: Eye,
      description: "Users viewing now",
      gradient: "from-violet-500/10 to-violet-600/5",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your digital product platform
          </p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-xl ${c.iconBg} p-3`}>
                <c.icon className={`h-5 w-5 ${c.iconColor}`} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold tracking-tight text-foreground">{c.value}</p>
              <p className="mt-1 text-sm font-medium text-foreground/80">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Info */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Navigate to Files to upload products, or Access Codes to generate shareable preview links.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="#/admin/files"
            className="inline-flex items-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
          >
            <FolderOpen className="h-4 w-4" />
            Upload Files
          </a>
          <a
            href="#/admin/codes"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
          >
            <KeyRound className="h-4 w-4" />
            Generate Code
          </a>
        </div>
      </div>
    </div>
  );
}
