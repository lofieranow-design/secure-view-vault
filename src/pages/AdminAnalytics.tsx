import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Eye, Clock, TrendingUp, Users, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface DailyStat { date: string; views: number; }
interface TopFile { filename: string; views: number; }

export default function AdminAnalytics() {
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueSessions, setUniqueSessions] = useState(0);
  const [avgDuration, setAvgDuration] = useState("0m");
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { count: viewCount } = await supabase.from("activity_log").select("*", { count: "exact", head: true }).eq("event_type", "file_view");
      setTotalViews(viewCount ?? 0);

      const { count: sessionCount } = await supabase.from("viewer_sessions").select("*", { count: "exact", head: true });
      setUniqueSessions(sessionCount ?? 0);

      const { data: sessions } = await supabase.from("viewer_sessions").select("session_start, session_expiry");
      if (sessions && sessions.length > 0) {
        const totalMinutes = sessions.reduce((acc, s) => {
          return acc + (new Date(s.session_expiry).getTime() - new Date(s.session_start).getTime()) / 60000;
        }, 0);
        const avg = Math.round(totalMinutes / sessions.length);
        setAvgDuration(avg >= 60 ? `${Math.round(avg / 60)}h` : `${avg}m`);
      }

      const { data: logs } = await supabase.from("activity_log").select("created_at").eq("event_type", "file_view")
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()).order("created_at", { ascending: true });

      if (logs) {
        const grouped: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) grouped[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
        logs.forEach((l) => { const d = l.created_at.slice(0, 10); if (grouped[d] !== undefined) grouped[d]++; });
        setDailyStats(Object.entries(grouped).map(([date, views]) => ({ date: date.slice(5), views })));
      }

      const { data: fileLogs } = await supabase.from("activity_log").select("details").eq("event_type", "file_view");
      if (fileLogs) {
        const counts: Record<string, number> = {};
        fileLogs.forEach((l) => { const n = (l.details as any)?.filename || "Unknown"; counts[n] = (counts[n] || 0) + 1; });
        setTopFiles(Object.entries(counts).map(([filename, views]) => ({ filename, views })).sort((a, b) => b.views - a.views).slice(0, 5));
      }

      const { data: recent } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10);
      if (recent) setRecentEvents(recent);
    };
    fetchAnalytics();
  }, []);

  const statCards = [
    { label: "Total Views", value: totalViews, icon: Eye },
    { label: "Unique Sessions", value: uniqueSessions, icon: Users },
    { label: "Avg Duration", value: avgDuration, icon: Clock },
    { label: "Top Files", value: topFiles.length, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track viewer engagement and file performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Views (14 days)</h2>
          </div>
          <div className="h-48">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="views" stroke="hsl(43, 96%, 56%)" fill="url(#viewGrad)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Top Files</h2>
          </div>
          <div className="h-48">
            {topFiles.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFiles} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="filename" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
                  <Bar dataKey="views" fill="hsl(43, 96%, 56%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium text-foreground">Recent Activity</h2>
        {recentEvents.length > 0 ? (
          <div className="space-y-1">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-[13px] text-foreground">{event.event_type.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        )}
      </div>
    </div>
  );
}
