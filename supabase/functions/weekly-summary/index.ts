import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get: (key: string) => string | undefined };
};

const METRICS = [
  { id: "comments",    label: "LinkedIn Comments", goal: 5,  cadence: "daily"  },
  { id: "followups",   label: "Follow-ups Sent",   goal: 15, cadence: "daily"  },
  { id: "connections", label: "New Connections",   goal: 15, cadence: "daily"  },
  { id: "replies",     label: "Replies Received",  goal: 5,  cadence: "daily"  },
  { id: "posts",       label: "Posts Published",   goal: 3,  cadence: "weekly" },
  { id: "calls",       label: "Calls Booked",      goal: 8,  cadence: "weekly" },
];

// Returns the Monday of the week containing the given UTC date
function getMondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getNewYorkHourAndWeekday(d: Date): { hour: number; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "00";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return { hour: Number(hourPart), weekday: weekdayPart };
}

Deno.serve(async (req) => {
  // Allow manual triggers via POST as well as cron invocations
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  let scheduledRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      scheduledRun = Boolean(body?.scheduled);
    } catch {
      scheduledRun = false;
    }
  }

  if (scheduledRun) {
    const now = new Date();
    const ny = getNewYorkHourAndWeekday(now);
    if (ny.weekday !== "Mon" || ny.hour !== 7) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Scheduled run allowed only at 7:00 AM America/New_York on Monday" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const summaryUserEmail = (Deno.env.get("SUMMARY_USER_EMAIL") ?? Deno.env.get("RECIPIENT_EMAIL") ?? "").trim().toLowerCase();
    if (!summaryUserEmail) {
      throw new Error("Missing SUMMARY_USER_EMAIL (or RECIPIENT_EMAIL fallback) secret");
    }

    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) throw new Error(`auth user lookup: ${usersError.message}`);
    const matchingUser = usersPage.users.find(
      (u: { email?: string | null }) => (u.email ?? "").trim().toLowerCase() === summaryUserEmail
    );
    if (!matchingUser?.id) throw new Error(`No auth user found for ${summaryUserEmail}`);
    const userId = matchingUser.id;

    // Build Mon–Fri dates for the previous week
    const now = new Date();
    const monday = getMondayOf(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const weekDays = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return isoDate(d);
    });

    // Fetch metrics + reflections in parallel
    const [metricsRes, reflectionsRes] = await Promise.all([
      supabase.from("metrics").select("date, metric_id, value").eq("user_id", userId).in("date", weekDays),
      supabase.from("reflections").select("date, wins, learnings, stretches, is_day_off").eq("user_id", userId).in("date", weekDays),
    ]);

    if (metricsRes.error) throw new Error(`metrics fetch: ${metricsRes.error.message}`);
    if (reflectionsRes.error) throw new Error(`reflections fetch: ${reflectionsRes.error.message}`);

    // Shape metrics into { date: { metricId: value } }
    const metricsMap: Record<string, Record<string, number>> = {};
    for (const row of metricsRes.data ?? []) {
      metricsMap[row.date] ??= {};
      metricsMap[row.date][row.metric_id] = row.value;
    }

    // Count days off (only daily-metric goals are reduced)
    const daysOff = (reflectionsRes.data ?? []).filter((r: { is_day_off?: boolean }) => r.is_day_off).length;
    const effectiveDays = Math.max(1, 5 - daysOff);

    // Calculate week totals
    const weekTotals: Record<string, number> = {};
    for (const m of METRICS) {
      weekTotals[m.id] = weekDays.reduce((sum, d) => sum + (metricsMap[d]?.[m.id] ?? 0), 0);
    }

    // Gather wins + learnings, sorted by date
    const sortedReflections = (reflectionsRes.data ?? []).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    const winsEntries = sortedReflections
      .filter((r: { wins?: string | null }) => r.wins?.trim())
      .map((r: { wins?: string | null }) => r.wins!.trim());
    const learningsEntries = sortedReflections
      .filter((r: { learnings?: string | null }) => r.learnings?.trim())
      .map((r: { learnings?: string | null }) => r.learnings!.trim());
    const stretchesEntries = sortedReflections
      .filter((r: { stretches?: string | null }) => r.stretches?.trim())
      .map((r: { stretches?: string | null }) => r.stretches!.trim());

    // Effective goal helper (reduces daily metric goals by days-off count)
    const effectiveGoalFor = (m: typeof METRICS[number]) =>
      m.cadence === "daily" ? m.goal * effectiveDays : m.goal;

    // Week label
    const fri = new Date(monday);
    fri.setUTCDate(monday.getUTCDate() + 4);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const weekLabel = `${monday.toLocaleDateString("en-US", opts)} – ${fri.toLocaleDateString("en-US", opts)}`;

    // Build text summary for Claude
    const metricLines = METRICS.map(m => {
      const total = weekTotals[m.id];
      const effectiveGoal = effectiveGoalFor(m);
      const pct = Math.round((total / effectiveGoal) * 100);
      const flag = total >= effectiveGoal ? "✓" : total >= effectiveGoal * 0.7 ? "~" : "✗";
      return `${flag} ${m.label}: ${total}/${effectiveGoal} (${pct}%)`;
    }).join("\n");

    // Call Claude for themes + narrative. If no reflections exist yet,
    // Claude still summarizes metrics and provides practical next steps.
    let aiNarrative = "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (anthropicKey) {
      const winsText      = winsEntries.length > 0      ? winsEntries.join("\n")      : "None recorded this week.";
      const learningsText = learningsEntries.length > 0 ? learningsEntries.join("\n") : "None recorded this week.";
      const stretchesText = stretchesEntries.length > 0 ? stretchesEntries.join("\n") : "None recorded this week.";

      const prompt = `You are writing a weekly summary for a professional tracking their LinkedIn outreach and relationship-building activity. Be direct, grounded, and specific — positive without being generic or pep-talk-y. Use the actual data.

METRICS THIS WEEK:
${metricLines}

WINS (raw notes from each day):
${winsText}

LEARNINGS (raw notes from each day):
${learningsText}

STRETCHES — uncomfortable things done each day:
${stretchesText}

Write a concise weekly summary with four clearly labeled sections:

**Wins** — identify 2–3 meaningful themes emerging from the wins. Tie them to concrete evidence from the notes. Keep it real and specific.

**Learnings** — identify 2–3 key threads from the learnings, framed as insights rather than mistakes. Be constructive and forward-looking.

**Stretches** — identify 2–3 patterns in the uncomfortable actions taken. Acknowledge the courage it takes and connect them to growth.

**Looking Ahead** — 2–3 sentences connecting patterns from this week to next week. Concrete, actionable, grounded in the person's actual numbers and observations.

Format: plain text suitable for email. Use **bold** for section names only. About 250–300 words total. No bullet points — write in short paragraphs.

If wins, learnings, or stretches are not recorded, explicitly acknowledge that and still provide a useful analysis from the metrics and pace patterns.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (claudeRes.ok) {
        const claudeJson = await claudeRes.json();
        aiNarrative = claudeJson.content?.[0]?.text?.trim() ?? "";
      }
    }

    // Build metrics table HTML rows
    const metricsRows = METRICS.map(m => {
      const total = weekTotals[m.id];
      const effectiveGoal = effectiveGoalFor(m);
      const pct = Math.round((total / effectiveGoal) * 100);
      const hit = total >= effectiveGoal;
      const color = hit ? "#a6e3a1" : pct >= 70 ? "#f9e2af" : "#f38ba8";
      return `<tr>
        <td style="padding:9px 14px;border-bottom:1px solid #1e1e2e;color:#cdd6f4;font-size:13px;">${m.label}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #1e1e2e;text-align:center;font-family:monospace;color:${color};font-size:13px;font-weight:${hit ? 700 : 400};">${total}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #1e1e2e;text-align:center;font-family:monospace;color:#6c7086;font-size:13px;">${effectiveGoal}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #1e1e2e;text-align:center;font-family:monospace;color:${color};font-size:13px;">${pct}%</td>
      </tr>`;
    }).join("");

    // Format ai narrative as HTML (handle **bold** markers)
    const formatNarrative = (text: string) =>
      text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n\n/g, "</p><p style='margin:0 0 12px;'>")
        .replace(/\n/g, "<br>");

    const aiSection = aiNarrative
      ? `<div style="margin-top:32px;padding:20px 24px;background:#181825;border-radius:12px;">
          <p style="margin:0 0 12px;line-height:1.75;color:#cdd6f4;font-size:13px;">${formatNarrative(aiNarrative)}</p>
        </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#13131a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 16px;margin:0;color:#cdd6f4;">
  <div style="max-width:560px;margin:0 auto;">

    <div style="margin-bottom:28px;">
      <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#45475a;font-family:monospace;margin-bottom:6px;">LRBD · Weekly Summary</div>
      <h1 style="color:#cdd6f4;font-size:22px;margin:0;font-weight:700;letter-spacing:-0.02em;">${weekLabel}</h1>
    </div>

    <table style="width:100%;border-collapse:collapse;background:#1e1e2e;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#11111b;">
          <th style="padding:10px 14px;text-align:left;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#45475a;font-weight:600;">Metric</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#45475a;font-weight:600;">Total</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#45475a;font-weight:600;">Goal</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#45475a;font-weight:600;">%</th>
        </tr>
      </thead>
      <tbody>${metricsRows}</tbody>
    </table>

    ${aiSection}

    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1e1e2e;font-size:10px;color:#313244;text-align:center;letter-spacing:0.08em;text-transform:uppercase;">
      LRBD Tracker &nbsp;·&nbsp; Weekly summary &nbsp;·&nbsp; Every Monday at 7am ET
    </div>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendKey      = Deno.env.get("RESEND_API_KEY");
    const recipientEmail = Deno.env.get("RECIPIENT_EMAIL");
    const fromAddress    = Deno.env.get("FROM_EMAIL") ?? "LRBD Tracker <onboarding@resend.dev>";

    if (!resendKey || !recipientEmail) {
      throw new Error("Missing RESEND_API_KEY or RECIPIENT_EMAIL secrets");
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [recipientEmail], subject: `Weekly Summary — ${weekLabel}`, html }),
    });

    if (!resendRes.ok) {
      const body = await resendRes.text();
      throw new Error(`Resend error ${resendRes.status}: ${body}`);
    }

    return new Response(JSON.stringify({ ok: true, week: weekLabel }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("weekly-summary error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
