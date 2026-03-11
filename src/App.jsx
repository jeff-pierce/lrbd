import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ───────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── User ID: hardcoded permanent ID, same across all devices ──

const USER_ID = "d37bd602-65bb-4c95-b1fd-9a42ff87a6b3";

// ── Metrics config ────────────────────────────────────────────
const METRICS = [
  { id: "comments",    label: "LinkedIn Comments", icon: "💬", color: "#00C6A7", goal: 5,  cadence: "daily" },
  { id: "followups",   label: "Follow-ups Sent",   icon: "📨", color: "#FF6B35", goal: 20, cadence: "daily" },
  { id: "connections", label: "New Connections",   icon: "🤝", color: "#845EF7", goal: 15, cadence: "daily" },
  { id: "replies",     label: "Replies Received",  icon: "↩️", color: "#4DABF7", goal: 5,  cadence: "daily" },
  { id: "posts",       label: "Posts Published",   icon: "✍️", color: "#FFD43B", goal: 3,  cadence: "weekly" },
  { id: "calls",       label: "Calls Booked",      icon: "📞", color: "#E064F7", goal: 8,  cadence: "weekly" },
];

const DAILY_METRICS  = METRICS.filter(m => m.cadence === "daily");
const WEEKLY_METRICS = METRICS.filter(m => m.cadence === "weekly");

// ── Date helpers ──────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

function getMondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}

function getWeekDays(mondayStr) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mondayStr + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function workDayIndex(dateStr) {
  const day = new Date(dateStr + "T00:00:00").getDay();
  if (day === 0 || day === 6) return 5;
  return day;
}

// ── Supabase data helpers ─────────────────────────────────────
// Load all rows for this user and reshape into { date: { metricId: value } }
async function fetchAllData() {
  const { data, error } = await supabase
    .from("metrics")
    .select("date, metric_id, value")
    .eq("user_id", USER_ID);

  if (error) throw error;

  const shaped = {};
  for (const row of data) {
    if (!shaped[row.date]) shaped[row.date] = {};
    shaped[row.date][row.metric_id] = row.value;
  }
  return shaped;
}

// Upsert a single metric value
async function upsertMetric(date, metricId, value) {
  const { error } = await supabase
    .from("metrics")
    .upsert(
      { user_id: USER_ID, date, metric_id: metricId, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date,metric_id" }
    );
  if (error) throw error;
}

// ── Ring SVG ──────────────────────────────────────────────────
function Ring({ value, goal, color, size = 72 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(value / goal, 1))}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

// ── Daily metric card ─────────────────────────────────────────
function DailyCard({ metric, value, onIncrement, onDecrement }) {
  const pct = Math.min(Math.round((value / metric.goal) * 100), 100);
  const done = value >= metric.goal;
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${done ? metric.color + "55" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, padding: "20px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden", transition: "border-color 0.3s",
    }}>
      {done && <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${metric.color}, transparent)`,
        animation: "pulse 2s ease-in-out infinite",
      }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 24, marginBottom: 3 }}>{metric.icon}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.07em", textTransform: "uppercase", lineHeight: 1.3 }}>
            {metric.label}
          </div>
        </div>
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <Ring value={value} goal={metric.goal} color={metric.color} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            {pct}%
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onDecrement} style={{
          width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
          fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        >−</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700, color: done ? metric.color : "#fff", transition: "color 0.3s" }}>{value}</span>
          <span style={{ color: "rgba(255,255,255,0.22)", fontFamily: "'DM Mono', monospace", fontSize: 13, marginLeft: 3 }}>/{metric.goal}</span>
        </div>
        <button onClick={onIncrement} style={{
          width: 34, height: 34, borderRadius: 9, border: `1px solid ${metric.color}55`,
          background: `${metric.color}18`, color: metric.color,
          fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.background = `${metric.color}30`}
          onMouseLeave={e => e.currentTarget.style.background = `${metric.color}18`}
        >+</button>
      </div>
    </div>
  );
}

// ── Weekly metric card ────────────────────────────────────────
function WeeklyCard({ metric, weekTotal, todayValue, onIncrement, onDecrement }) {
  const pct = Math.min(Math.round((weekTotal / metric.goal) * 100), 100);
  const done = weekTotal >= metric.goal;
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${done ? metric.color + "55" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, padding: "20px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden", transition: "border-color 0.3s",
    }}>
      {done && <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${metric.color}, transparent)`,
        animation: "pulse 2s ease-in-out infinite",
      }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 24, marginBottom: 3 }}>{metric.icon}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.07em", textTransform: "uppercase", lineHeight: 1.3 }}>
            {metric.label}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>week total</div>
        </div>
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <Ring value={weekTotal} goal={metric.goal} color={metric.color} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            {pct}%
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 2 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700, color: done ? metric.color : "#fff" }}>{weekTotal}</span>
        <span style={{ color: "rgba(255,255,255,0.22)", fontFamily: "'DM Mono', monospace", fontSize: 13, marginLeft: 3 }}>/{metric.goal} wk</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "8px 12px" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", flex: 1 }}>TODAY</span>
        <button onClick={onDecrement} style={{
          width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
          fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        >−</button>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: "center", color: metric.color }}>{todayValue}</span>
        <button onClick={onIncrement} style={{
          width: 28, height: 28, borderRadius: 7, border: `1px solid ${metric.color}55`,
          background: `${metric.color}18`, color: metric.color,
          fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = `${metric.color}30`}
          onMouseLeave={e => e.currentTarget.style.background = `${metric.color}18`}
        >+</button>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

// ── Sync status indicator ─────────────────────────────────────
function SyncDot({ status }) {
  const config = {
    synced:  { color: "#00C6A7", label: "Synced" },
    syncing: { color: "#FFD43B", label: "Saving..." },
    error:   { color: "#FF5555", label: "Sync error" },
    loading: { color: "rgba(255,255,255,0.3)", label: "Loading..." },
  }[status] || { color: "rgba(255,255,255,0.3)", label: "" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: config.color,
        boxShadow: status === "synced" ? `0 0 6px ${config.color}` : "none",
        animation: status === "syncing" ? "pulse 1s ease-in-out infinite" : "none",
      }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{config.label}</span>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────
function HistoryRow({ dateStr, data }) {
  const hits = DAILY_METRICS.filter(m => (data[m.id] || 0) >= m.goal).length;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr repeat(6, 40px) 36px",
      gap: 4, alignItems: "center", padding: "10px 14px", borderRadius: 10,
      background: "rgba(255,255,255,0.025)",
    }}>
      <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{formatDate(dateStr)}</div>
      {METRICS.map(m => {
        const v = data[m.id] || 0;
        const done = m.cadence === "daily" && v >= m.goal;
        return (
          <div key={m.id} style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: done ? m.color : "rgba(255,255,255,0.3)", fontWeight: done ? 700 : 400 }}>{v}</div>
        );
      })}
      <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: hits === DAILY_METRICS.length ? "#00C6A7" : "rgba(255,255,255,0.35)" }}>
        {hits}/{DAILY_METRICS.length}
      </div>
    </div>
  );
}

// ── This Week view ────────────────────────────────────────────
function WeekView({ allData }) {
  const monday = getMondayOf(todayStr());
  const weekDays = getWeekDays(monday);
  const todayDate = todayStr();
  const daysElapsed = Math.max(1, Math.min(workDayIndex(todayDate), 5));
  const daysRemaining = Math.max(0, 5 - daysElapsed);

  const weekTotals = {};
  METRICS.forEach(m => {
    weekTotals[m.id] = weekDays.reduce((s, d) => s + (allData[d]?.[m.id] || 0), 0);
  });

  const effectiveWeekGoal = (m) => m.cadence === "daily" ? m.goal * 5 : m.goal;

  const pace = (m) => {
    const actual = weekTotals[m.id];
    const goal = effectiveWeekGoal(m);
    if (actual >= goal) return "done";
    const required = (goal / 5) * daysElapsed;
    if (actual >= required * 0.9) return "on-track";
    if (actual >= required * 0.6) return "behind";
    return "at-risk";
  };

  const statusConfig = {
    "done":     { label: "Goal hit! 🎉",   bg: "#00C6A720", border: "#00C6A755", text: "#00C6A7" },
    "on-track": { label: "On track ✓",     bg: "#00C6A712", border: "#00C6A733", text: "#00C6A7" },
    "behind":   { label: "Falling behind", bg: "#FF6B3515", border: "#FF6B3544", text: "#FF6B35" },
    "at-risk":  { label: "At risk ⚠",      bg: "#FF3B3015", border: "#FF3B3055", text: "#FF5555" },
  };

  const projected = (m) => Math.round((weekTotals[m.id] / daysElapsed) * 5);

  const mon = new Date(monday + "T00:00:00");
  const fri = new Date(monday + "T00:00:00");
  fri.setDate(fri.getDate() + 4);
  const opts = { month: "short", day: "numeric" };
  const weekLabel = `${mon.toLocaleDateString("en-US", opts)} – ${fri.toLocaleDateString("en-US", opts)}`;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const onTrackCount = METRICS.filter(m => pace(m) === "done" || pace(m) === "on-track").length;

  const MetricWeekRow = ({ m }) => {
    const actual = weekTotals[m.id];
    const goal = effectiveWeekGoal(m);
    const pct = Math.min(Math.round((actual / goal) * 100), 100);
    const status = pace(m);
    const sc = statusConfig[status];
    const proj = projected(m);
    const neededPerDay = daysRemaining > 0 ? Math.ceil(Math.max(0, goal - actual) / daysRemaining) : 0;
    const barColor = status === "done" || status === "on-track" ? m.color : status === "behind" ? "#FF6B35" : "#FF5555";

    return (
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                {actual} / {goal}{m.cadence === "daily" ? ` (5×${m.goal})` : " wk"} · {pct}%
              </div>
            </div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 20, background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 11, fontWeight: 600, color: sc.text, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
            {sc.label}
          </div>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: barColor, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {weekDays.map((d, i) => {
            const v = allData[d]?.[m.id] || 0;
            const hit = m.cadence === "daily" ? v >= m.goal : v > 0;
            const isToday = d === todayDate;
            const isPast = d <= todayDate;
            return (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: 28, borderRadius: 6,
                  background: hit ? `${m.color}30` : isPast ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: isToday ? `1px solid ${m.color}88` : hit ? `1px solid ${m.color}55` : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                  color: hit ? m.color : isPast ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
                  fontWeight: hit ? 700 : 400, transition: "all 0.2s",
                }}>
                  {v > 0 ? v : "·"}
                </div>
                <div style={{ fontSize: 9, color: isToday ? m.color : "rgba(255,255,255,0.2)", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>{dayNames[i]}</div>
              </div>
            );
          })}
        </div>
        {status !== "done" && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
            {daysRemaining > 0
              ? <>Need <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{neededPerDay}/day</span> for {daysRemaining} more day{daysRemaining !== 1 ? "s" : ""} · Projected: <span style={{ color: proj >= goal ? "#00C6A7" : "#FF6B35", fontWeight: 700 }}>{proj}</span> by Fri</>
              : <>Week ended · {actual >= goal ? "Goal reached ✓" : `Finished ${actual}/${goal}`}</>
            }
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card-appear">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>Current Week</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{weekLabel}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Day <span style={{ color: "#fff", fontWeight: 700 }}>{daysElapsed}</span> of 5
          </div>
          {daysRemaining > 0 && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{daysRemaining}d left</div>}
        </div>
      </div>
      <SectionLabel>Daily Goals · Week Totals</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {DAILY_METRICS.map(m => <MetricWeekRow key={m.id} m={m} />)}
      </div>
      <SectionLabel>Weekly Goals</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {WEEKLY_METRICS.map(m => <MetricWeekRow key={m.id} m={m} />)}
      </div>
      <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Goals on track this week</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: onTrackCount === METRICS.length ? "#00C6A7" : "#fff" }}>
          {onTrackCount}<span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/{METRICS.length}</span>
        </span>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [allData, setAllData]       = useState({});
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [tab, setTab]               = useState("today");
  const [syncStatus, setSyncStatus] = useState("loading");
  const pendingRef = useRef({});
  const debounceRef = useRef({});

  const loadData = useCallback(async (isInitialLoad = false) => {
    setSyncStatus(isInitialLoad ? "loading" : "syncing");
    try {
      const data = await fetchAllData();
      setAllData(data);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }, []);

  // Load all data from Supabase on mount
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Debounced upsert — waits 800ms after last tap before writing to Supabase
  const scheduleUpsert = useCallback((date, metricId, value) => {
    const key = `${date}:${metricId}`;
    pendingRef.current[key] = { date, metricId, value };
    clearTimeout(debounceRef.current[key]);
    setSyncStatus("syncing");
    debounceRef.current[key] = setTimeout(async () => {
      const { date: d, metricId: mid, value: v } = pendingRef.current[key];
      try {
        await upsertMetric(d, mid, v);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, 800);
  }, []);

  const update = useCallback((metricId, delta) => {
    setAllData(prev => {
      const prevVal = prev[selectedDate]?.[metricId] || 0;
      const newVal = Math.max(0, prevVal + delta);
      const updated = {
        ...prev,
        [selectedDate]: { ...prev[selectedDate], [metricId]: newVal },
      };
      scheduleUpsert(selectedDate, metricId, newVal);
      return updated;
    });
  }, [selectedDate, scheduleUpsert]);

  const dayData = allData[selectedDate] || {};

  const monday = getMondayOf(selectedDate);
  const weekDays = getWeekDays(monday);
  const weekTotals = {};
  WEEKLY_METRICS.forEach(m => {
    weekTotals[m.id] = weekDays.reduce((s, d) => s + (allData[d]?.[m.id] || 0), 0);
  });

  const dailyGoalsHit = DAILY_METRICS.filter(m => (dayData[m.id] || 0) >= m.goal).length;
  const history = Object.entries(allData).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "'Sora', sans-serif", color: "#fff", padding: "0 0 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .card-appear { animation: fadeIn 0.3s ease forwards; }
        button:active { transform: scale(0.95); }
      `}</style>

      <div style={{ padding: "40px 24px 0", maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>LRBD Tracker</div>
              <SyncDot status={syncStatus} />
              <button
                onClick={() => loadData(false)}
                disabled={syncStatus === "loading" || syncStatus === "syncing"}
                aria-label="Refresh data"
                title="Refresh data"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: syncStatus === "loading" || syncStatus === "syncing" ? "default" : "pointer",
                  opacity: syncStatus === "loading" || syncStatus === "syncing" ? 0.45 : 1,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (syncStatus !== "loading" && syncStatus !== "syncing") {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                }}
              >
                ↻
              </button>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {tab === "week" ? "This Week" : tab === "history" ? "History" : selectedDate === todayStr() ? "Today" : formatDate(selectedDate)}
            </h1>
          </div>
          {tab === "today" && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: dailyGoalsHit === DAILY_METRICS.length ? "#00C6A7" : "#fff" }}>
                {dailyGoalsHit}<span style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/{DAILY_METRICS.length}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>daily goals</div>
            </div>
          )}
        </div>

        {tab === "today" ? (
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginBottom: 28, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${(dailyGoalsHit / DAILY_METRICS.length) * 100}%`, background: "linear-gradient(90deg, #845EF7, #00C6A7)", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        ) : <div style={{ marginBottom: 28 }} />}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 12 }}>
          {[["today", "Today"], ["week", "This Week"], ["history", "History"]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer",
              background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.35)",
              fontSize: 12, fontWeight: 600, fontFamily: "'Sora', sans-serif",
              transition: "all 0.2s", letterSpacing: "0.01em",
            }}>{label}</button>
          ))}
        </div>

        {/* Loading state */}
        {syncStatus === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
            Loading your data...
          </div>
        )}

        {/* TODAY TAB */}
        {tab === "today" && syncStatus !== "loading" && (
          <div className="card-appear">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <input type="date" value={selectedDate} max={todayStr()} onChange={e => setSelectedDate(e.target.value)} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "8px 12px", color: "#fff",
                fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", outline: "none", colorScheme: "dark",
              }} />
              {selectedDate !== todayStr() && (
                <button onClick={() => setSelectedDate(todayStr())} style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "8px 12px", color: "rgba(255,255,255,0.5)",
                  fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer",
                }}>← Today</button>
              )}
            </div>
            <SectionLabel>Daily Goals</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {DAILY_METRICS.map((m, i) => (
                <div key={m.id} className="card-appear" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: "both" }}>
                  <DailyCard metric={m} value={dayData[m.id] || 0} onIncrement={() => update(m.id, 1)} onDecrement={() => update(m.id, -1)} />
                </div>
              ))}
            </div>
            <SectionLabel>Weekly Goals</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {WEEKLY_METRICS.map((m, i) => (
                <div key={m.id} className="card-appear" style={{ animationDelay: `${(DAILY_METRICS.length + i) * 0.06}s`, animationFillMode: "both" }}>
                  <WeeklyCard metric={m} weekTotal={weekTotals[m.id]} todayValue={dayData[m.id] || 0} onIncrement={() => update(m.id, 1)} onDecrement={() => update(m.id, -1)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* THIS WEEK TAB */}
        {tab === "week" && syncStatus !== "loading" && <WeekView allData={allData} />}

        {/* HISTORY TAB */}
        {tab === "history" && syncStatus !== "loading" && (
          <div className="card-appear">
            {history.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", padding: "60px 0", fontSize: 14 }}>No history yet — start tracking today!</div>
            ) : (
              <>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr repeat(6, 40px) 36px",
                  gap: 4, padding: "0 14px 10px", fontSize: 10, color: "rgba(255,255,255,0.25)",
                  fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  <div>Date</div>
                  {METRICS.map(m => <div key={m.id} style={{ textAlign: "center" }}>{m.icon}</div>)}
                  <div style={{ textAlign: "center" }}>✓</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {history.map(([date, data]) => <HistoryRow key={date} dateStr={date} data={data} />)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
