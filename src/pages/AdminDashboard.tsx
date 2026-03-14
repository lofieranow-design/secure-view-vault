import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, KeyRound, Eye, Clock } from "lucide-react";

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
    { label: "Total Files", value: stats.files, icon: FolderOpen, color: "text-primary" },
    { label: "Total Codes", value: stats.codes, icon: KeyRound, color: "text-accent" },
    { label: "Active Codes", value: stats.activeCodes, icon: Clock, color: "text-success" },
    { label: "Active Sessions", value: stats.sessions, icon: Eye, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-bold text-foreground">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
