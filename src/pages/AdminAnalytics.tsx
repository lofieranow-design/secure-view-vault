import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye, Clock, TrendingUp, Users, FileText, BarChart3,
  KeyRound, TimerOff, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

interface DailyStat { date: string; views: number }
interface TopFile { filename: string; views: number }
interface ActivityEvent {
  id: string;
  event_type: string;
  created_at: string;
  details: any;
}

const EVENT_META: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  file_view: { icon: Eye, label: "User viewed", color: "text-blue-500" },
  code_activated: { icon: KeyRound, label: "Access code used", color: "text-primary" },
  session_expired: { icon: TimerOff, label: "Preview expired", color: "text-muted-foreground" },
  code_validated: { icon: KeyRound, label: "Code validated", color: "text-emerald-500" },
};

const CHART_COLORS = [
  "hsl(43, 96%, 56%)",
  "hsl(43, 80%, 44%)",
  "hsl(43, 60%, 36%)",
  "hsl(43, 40%, 28%)",
  "hsl(43, 20%, 20%)",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

export default function AdminAnalytics() {
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueSessions, setUniqueSessions] = useState(0);
  const [avgDuration, setAvgDuration] = useState("0m");
  const [conversionRate, setConversionRate] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [recentEvents, setRecentEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Total views
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

      // Avg duration
      const { data: sessions } = await supabase
        .from("viewer_sessions")
        .select("session_start, session_expiry");
      if (sessions && sessions.length > 0) {
        const totalMinutes = sessions.reduce((acc, s) => {
          return acc + (new Date(s.session_expiry).getTime() - new Date(s.session_start).getTime()) / 60000;
        }, 0);
        const avg = Math.round(totalMinutes / sessions.length);
        setAvgDuration(avg >= 60 ? `${Math.round(avg / 60)}h` : `${avg}m`);
      }

      // Conversion rate (codes activated / total codes)
      const { count: totalCodes } = await supabase
        .from("access_codes")
        .select("*", { count: "exact", head: true });
      const { count: activatedCodes } = await supabase
        .from("access_codes")
        .select("*", { count: "exact", head: true })
        .not("activated_at", "is", null);
      if (totalCodes && totalCodes > 0) {
        setConversionRate(Math.round(((activatedCodes ?? 0) / totalCodes) * 100));
      }

      // Daily views (14 days)
      const { data: logs } = await supabase
        .from("activity_log")
        .select("created_at")
        .eq("event_type", "file_view")
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("created_at", { ascending: true });
      if (logs) {
        const grouped: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) grouped[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
        logs.forEach((l) => { const d = l.created_at.slice(0, 10); if (grouped[d] !== undefined) grouped[d]++; });
        setDailyStats(Object.entries(grouped).map(([date, views]) => ({ date: date.slice(5), views })));
      }

      // Top files (views per product)
      const { data: fileLogs } = await supabase
        .from("activity_log")
        .select("details")
        .eq("event_type", "file_view");
      if (fileLogs) {
        const counts: Record<string, number> = {};
        fileLogs.forEach((l) => {
          const n = (l.details as any)?.filename || "Unknown";
          counts[n] = (counts[n] || 0) + 1;
        });
        setTopFiles(
          Object.entries(counts)
            .map(([filename, views]) => ({ filename, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 5)
        );
      }

      // Recent activity
      const { data: recent } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (recent) setRecentEvents(recent as ActivityEvent[]);
    };
    fetchAnalytics();
  }, []);

  const statCards = [
    { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye, trend: "+12%", up: true },
    { label: "Unique Sessions", value: uniqueSessions.toLocaleString(), icon: Users, trend: "+8%", up: true },
    { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, trend: "+3%", up: true },
    { label: "Avg Duration", value: avgDuration, icon: Clock, trend: "-2%", up: false },
  ];

  const conversionData = [
    { name: "Converted", value: conversionRate },
    { name: "Remaining", value: 100 - conversionRate },
  ];

  const formatEventDescription = (event: ActivityEvent) => {
    const meta = EVENT_META[event.event_type] || { icon: Eye, label: event.event_type.replace(/_/g, " "), color: "text-muted-foreground" };
    const filename = (event.details as any)?.filename;
    if (event.event_type === "file_view" && filename) {
      return { ...meta, label: `User viewed ${filename}` };
    }
    return meta;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track viewer engagement and product performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <div className="rounded-lg bg-accent/50 p-1.5">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${s.up ? "text-emerald-600" : "text-red-500"}`}>
                {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {s.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Views per Product - Area Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Views per Product</h2>
            </div>
            <span className="text-xs text-muted-foreground">Last 14 days</span>
          </div>
          <div className="h-56">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="views" stroke="hsl(43, 96%, 56%)" fill="url(#viewGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(43, 96%, 56%)", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No view data yet</div>
            )}
          </div>
        </div>

        {/* Conversion Rate - Donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Conversion Rate</h2>
          </div>
          <div className="flex flex-col items-center justify-center h-56">
            <div className="h-40 w-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={68}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    <Cell fill="hsl(43, 96%, 56%)" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tracking-tight text-foreground">{conversionRate}%</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Converted</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>Activated</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <span>Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Viewed Products */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Top Viewed Products</h2>
          </div>
          <span className="text-xs text-muted-foreground">{topFiles.length} products</span>
        </div>
        {topFiles.length > 0 ? (
          <div className="space-y-3">
            {topFiles.map((file, i) => {
              const maxViews = topFiles[0]?.views || 1;
              const pct = (file.views / maxViews) * 100;
              return (
                <div key={file.filename} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px] font-medium text-foreground truncate max-w-[200px]">{file.filename}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{file.views} views</span>
                  </div>
                  <div className="ml-6.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No product data yet</div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
          <span className="text-xs text-muted-foreground">{recentEvents.length} events</span>
        </div>
        {recentEvents.length > 0 ? (
          <div className="space-y-0.5">
            {recentEvents.map((event) => {
              const meta = formatEventDescription(event);
              const Icon = meta.icon;
              return (
                <div key={event.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-accent/80 p-1.5 ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[13px] text-foreground">{meta.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">No recent activity</div>
        )}
      </div>
    </div>
  );
}
