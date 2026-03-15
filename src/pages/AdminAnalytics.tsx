import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Eye, Clock, TrendingUp, Users, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface DailyStat {
  date: string;
  views: number;
}

interface TopFile {
  filename: string;
  views: number;
}

export default function AdminAnalytics() {
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueSessions, setUniqueSessions] = useState(0);
  const [avgDuration, setAvgDuration] = useState("0m");
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Total views from activity_log
      const { count: viewCount } = await supabase
        .from("activity_log")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "file_view");
      setTotalViews(viewCount ?? 0);

      // Unique sessions
      const { count: sessionCount } = await supabase
        .from("viewer_sessions")
        .select("*", { count: "exact", head: true });
      setUniqueSessions(sessionCount ?? 0);

      // Average session duration
      const { data: sessions } = await supabase
        .from("viewer_sessions")
        .select("session_start, session_expiry");
      if (sessions && sessions.length > 0) {
        const totalMinutes = sessions.reduce((acc, s) => {
          const start = new Date(s.session_start).getTime();
          const end = new Date(s.session_expiry).getTime();
          return acc + (end - start) / 60000;
        }, 0);
        const avg = Math.round(totalMinutes / sessions.length);
        setAvgDuration(avg >= 60 ? `${Math.round(avg / 60)}h` : `${avg}m`);
      }

      // Daily views (last 14 days)
      const { data: logs } = await supabase
        .from("activity_log")
        .select("created_at")
        .eq("event_type", "file_view")
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("created_at", { ascending: true });

      if (logs) {
        const grouped: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          grouped[d.toISOString().slice(0, 10)] = 0;
        }
        logs.forEach((l) => {
          const day = l.created_at.slice(0, 10);
          if (grouped[day] !== undefined) grouped[day]++;
        });
        setDailyStats(Object.entries(grouped).map(([date, views]) => ({ date: date.slice(5), views })));
      }

      // Top files by view count
      const { data: fileLogs } = await supabase
        .from("activity_log")
        .select("details")
        .eq("event_type", "file_view");

      if (fileLogs) {
        const fileCounts: Record<string, number> = {};
        fileLogs.forEach((l) => {
          const name = (l.details as any)?.filename || "Unknown";
          fileCounts[name] = (fileCounts[name] || 0) + 1;
        });
        setTopFiles(
          Object.entries(fileCounts)
            .map(([filename, views]) => ({ filename, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 5)
        );
      }

      // Recent events
      const { data: recent } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (recent) setRecentEvents(recent);
    };

    fetchAnalytics();
  }, []);

  const statCards = [
    { label: "Total Views", value: totalViews, icon: Eye, color: "text-blue-400" },
    { label: "Unique Sessions", value: uniqueSessions, icon: Users, color: "text-emerald-400" },
    { label: "Avg Duration", value: avgDuration, icon: Clock, color: "text-amber-400" },
    { label: "Top Files Viewed", value: topFiles.length, icon: FileText, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track viewer engagement and file performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Views Over Time */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground">Views (Last 14 Days)</h2>
          </div>
          <div className="h-52">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="views" stroke="hsl(43, 96%, 56%)" fill="url(#viewGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No view data yet</div>
            )}
          </div>
        </div>

        {/* Top Files */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground">Top Files</h2>
          </div>
          <div className="h-52">
            {topFiles.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFiles} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="filename" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="views" fill="hsl(43, 96%, 56%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No file views yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-foreground">Recent Activity</h2>
        {recentEvents.length > 0 ? (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">{event.event_type.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </span>
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
