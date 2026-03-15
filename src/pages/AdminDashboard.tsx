import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, KeyRound, Eye, Zap, ArrowUpRight } from "lucide-react";

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
    { label: "Total Files", value: stats.files, icon: FolderOpen, change: "Uploaded" },
    { label: "Generated Codes", value: stats.codes, icon: KeyRound, change: "Created" },
    { label: "Active Codes", value: stats.activeCodes, icon: Zap, change: "Available" },
    { label: "Active Sessions", value: stats.sessions, icon: Eye, change: "Live now" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-center justify-between">
              <c.icon className="h-4 w-4 text-muted-foreground" />
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{c.value}</p>
            <p className="text-[13px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Quick Actions</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Navigate to Files to upload products, or Access Codes to generate shareable preview links.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#/admin/files"
            className="inline-flex items-center gap-1.5 rounded-md gradient-gold px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Upload Files
          </a>
          <a
            href="#/admin/codes"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Generate Code
          </a>
        </div>
      </div>
    </div>
  );
}
