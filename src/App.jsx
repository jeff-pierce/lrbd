import { useState, useCallback } from "react";

const METRICS = [
  { id: "comments", label: "LinkedIn Comments", icon: "💬", color: "#00C6A7", goal: 5 },
  { id: "followups", label: "Follow-ups Sent", icon: "📨", color: "#FF6B35", goal: 10 },
  { id: "connections", label: "New Connections", icon: "🤝", color: "#845EF7", goal: 15 },
  { id: "posts", label: "Posts Published", icon: "✍️", color: "#FFD43B", goal: 1 },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

function getMondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
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

const STORAGE_KEY = "bizdev_metrics_v1";
function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function Ring({ value, goal, color, size = 80 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(value / goal, 1))}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

function MetricCard({ metric, value, onIncrement, onDecrement }) {
  const pct = Math.min(Math.round((value / metric.goal) * 100), 100);
  const done = value >= metric.goal;
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${done ? metric.color + "55" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, padding: "24px 20px",
      display: "flex", flexDirection: "column", gap: 12,
      position: "relative", overflow: "hidden", transition: "border-color 0.3s",
    }}>
      {done && <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${metric.color}, transparent)`,
        animation: "pulse 2s ease-in-out infinite",
      }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{metric.icon}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {metric.label}
          </div>
        </div>
        <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
          <Ring value={value} goal={metric.goal} color={metric.color} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {pct}%
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={onDecrement} style={{
          width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
          fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        >−</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 36, fontWeight: 700, color: done ? metric.color : "#fff", transition: "color 0.3s" }}>{value}</span>
          <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", fontSize: 14, marginLeft: 4 }}>/ {metric.goal}</span>
        </div>
        <button onClick={onIncrement} style={{
          width: 36, height: 36, borderRadius: 10, border: `1px solid ${metric.color}55`,
          background: `${metric.color}18`, color: metric.color,
          fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = `${metric.color}30`}
          onMouseLeave={e => e.currentTarget.style.background = `${metric.color}18`}
        >+</button>
      </div>
    </div>
  );
}

function HistoryRow({ dateStr, data }) {
  const hits = METRICS.filter(m => (data[m.id] || 0) >= m.goal).length;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr repeat(4, 52px) 48px",
      gap: 6, alignItems: "center", padding: "10px 16px", borderRadius: 10,
      background: "rgba(255,255,255,0.025)", fontSize: 13,
    }}>
      <div style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{formatDate(dateStr)}</div>
      {METRICS.map(m => {
        const v = data[m.id] || 0;
        const done = v >= m.goal;
        return (
          <div key={m.id} style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", color: done ? m.color : "rgba(255,255,255,0.35)", fontWeight: done ? 700 : 400 }}>{v}</div>
        );
      })}
      <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", color: hits === METRICS.length ? "#00C6A7" : "rgba(255,255,255,0.4)", fontSize: 12 }}>
        {hits}/{METRICS.length}
      </div>
    </div>
  );
}

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

  const weeklyGoal = (m) => m.goal * 5;

  const pace = (m) => {
    const actual = weekTotals[m.id];
    if (actual >= weeklyGoal(m)) return "done";
    const required = (weeklyGoal(m) / 5) * daysElapsed;
    if (actual >= required * 0.9) return "on-track";
    if (actual >= required * 0.6) return "behind";
    return "at-risk";
  };

  const statusConfig = {
    "done":     { label: "Goal hit! 🎉",     bg: "#00C6A720", border: "#00C6A755", text: "#00C6A7" },
    "on-track": { label: "On track ✓",        bg: "#00C6A712", border: "#00C6A733", text: "#00C6A7" },
    "behind":   { label: "Falling behind",    bg: "#FF6B3515", border: "#FF6B3544", text: "#FF6B35" },
    "at-risk":  { label: "At risk ⚠",         bg: "#FF3B3015", border: "#FF3B3055", text: "#FF5555" },
  };

  const projected = (m) => Math.round((weekTotals[m.id] / daysElapsed) * 5);

  const mon = new Date(monday + "T00:00:00");
  const fri = new Date(monday + "T00:00:00");
  fri.setDate(fri.getDate() + 4);
  const opts = { month: "short", day: "numeric" };
  const weekLabel = `${mon.toLocaleDateString("en-US", opts)} – ${fri.toLocaleDateString("en-US", opts)}`;

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const onTrackCount = METRICS.filter(m => pace(m) === "done" || pace(m) === "on-track").length;

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
          {daysRemaining > 0 && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
              {daysRemaining}d left until Friday
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {METRICS.map(m => {
          const actual = weekTotals[m.id];
          const goal = weeklyGoal(m);
          const pct = Math.min(Math.round((actual / goal) * 100), 100);
          const status = pace(m);
          const sc = statusConfig[status];
          const proj = projected(m);
          const needed = Math.max(0, goal - actual);
          const neededPerDay = daysRemaining > 0 ? Math.ceil(needed / daysRemaining) : 0;
          const barColor = status === "done" || status === "on-track" ? m.color : status === "behind" ? "#FF6B35" : "#FF5555";

          return (
            <div key={m.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "16px 18px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                      {actual} / {goal} · {pct}%
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 20,
                  background: sc.bg, border: `1px solid ${sc.border}`,
                  fontSize: 11, fontWeight: 600, color: sc.text,
                  fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap",
                }}>
                  {sc.label}
                </div>
              </div>

              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99, width: `${pct}%`,
                  background: barColor,
                  transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {weekDays.map((d, i) => {
                  const v = allData[d]?.[m.id] || 0;
                  const hit = v >= m.goal;
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
                      <div style={{ fontSize: 9, color: isToday ? m.color : "rgba(255,255,255,0.2)", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                        {dayNames[i]}
                      </div>
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
        })}
      </div>

      <div style={{
        marginTop: 16, padding: "14px 18px", borderRadius: 14,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Goals on track this week</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: onTrackCount === METRICS.length ? "#00C6A7" : "#fff" }}>
          {onTrackCount}<span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/{METRICS.length}</span>
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [allData, setAllData] = useState(() => loadData());
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [tab, setTab] = useState("today");

  const dayData = allData[selectedDate] || {};

  const update = useCallback((metricId, delta) => {
    setAllData(prev => {
      const updated = {
        ...prev,
        [selectedDate]: {
          ...prev[selectedDate],
          [metricId]: Math.max(0, (prev[selectedDate]?.[metricId] || 0) + delta),
        },
      };
      saveData(updated);
      return updated;
    });
  }, [selectedDate]);

  const totalToday = METRICS.reduce((s, m) => s + (dayData[m.id] || 0), 0);
  const goalsHit = METRICS.filter(m => (dayData[m.id] || 0) >= m.goal).length;
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
              LRBD Tracker
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {tab === "week" ? "This Week" : tab === "history" ? "History" : selectedDate === todayStr() ? "Today" : formatDate(selectedDate)}
            </h1>
          </div>
          {tab === "today" && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: goalsHit === METRICS.length ? "#00C6A7" : "#fff" }}>
                {goalsHit}<span style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/{METRICS.length}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>goals hit</div>
            </div>
          )}
        </div>

        {tab === "today" ? (
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginBottom: 28, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${(goalsHit / METRICS.length) * 100}%`, background: "linear-gradient(90deg, #845EF7, #00C6A7)", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        ) : <div style={{ marginBottom: 28 }} />}

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

        {tab === "today" && (
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {METRICS.map((m, i) => (
                <div key={m.id} className="card-appear" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: "both" }}>
                  <MetricCard metric={m} value={dayData[m.id] || 0} onIncrement={() => update(m.id, 1)} onDecrement={() => update(m.id, -1)} />
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16, padding: "16px 20px", borderRadius: 14,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Total actions today</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700 }}>{totalToday}</span>
            </div>
          </div>
        )}

        {tab === "week" && <WeekView allData={allData} />}

        {tab === "history" && (
          <div className="card-appear">
            {history.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", padding: "60px 0", fontSize: 14 }}>No history yet — start tracking today!</div>
            ) : (
              <>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr repeat(4, 52px) 48px",
                  gap: 6, padding: "0 16px 10px", fontSize: 10, color: "rgba(255,255,255,0.25)",
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
