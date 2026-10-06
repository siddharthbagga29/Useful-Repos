// Task state for the executive agent: validate the task file, rank what matters now, compute the
// delta since the last run, and decide which proactive triggers fire.

import type { Ranked, Task, TaskFile, TaskState, Trigger } from "./types.ts";

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["todo", "in_progress", "blocked", "done"]);

/** Throws with every problem listed, so a bad edit to tasks.json fails loudly and precisely. */
export function validateTasks(raw: unknown): TaskFile {
  const problems: string[] = [];
  const f = raw as Partial<TaskFile>;
  if (!f || typeof f !== "object") throw new Error("tasks file is not an object");
  if (f.version !== 1) problems.push("version must be 1");
  if (!Array.isArray(f.tasks)) throw new Error("tasks must be an array");
  const ids = new Set<string>();
  f.tasks.forEach((t, i) => {
    const at = `tasks[${i}]`;
    if (!t || typeof t.id !== "string" || !t.id) problems.push(`${at}.id missing`);
    else if (ids.has(t.id)) problems.push(`${at}.id "${t.id}" duplicated`);
    else ids.add(t.id);
    if (typeof t?.title !== "string" || !t.title) problems.push(`${at}.title missing`);
    if (!STATUSES.has(t?.status)) problems.push(`${at}.status invalid`);
    if (typeof t?.impact !== "number" || t.impact < 1 || t.impact > 5) problems.push(`${at}.impact must be 1–5`);
    if (typeof t?.due !== "string" || !ISO_DATE.test(t.due) || Number.isNaN(Date.parse(t.due))) problems.push(`${at}.due must be YYYY-MM-DD`);
    if (t?.status === "done" && !t.completedAt) problems.push(`${at}.completedAt required when done`);
    if (t?.status === "blocked" && !t.blockedOn) problems.push(`${at}.blockedOn required when blocked`);
  });
  if (problems.length) throw new Error(`invalid tasks file:\n- ${problems.join("\n- ")}`);
  return f as TaskFile;
}

/** Whole days from `now` (start of day, UTC) to the due date; negative when overdue. */
export function daysLeft(due: string, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${due}T00:00:00Z`) - today) / DAY);
}

/** Priority: impact, sharpened by urgency; blocked items rank by what they unblock. */
export function rank(tasks: Task[], now: Date): Ranked[] {
  return tasks
    .filter((t) => t.status !== "done")
    .map((t) => {
      const d = daysLeft(t.due, now);
      const reason: Ranked["reason"] = d < 0 ? "overdue" : t.status === "blocked" ? "blocked" : d <= 2 ? "due_soon" : "open";
      const urgency = d < 0 ? 3 + Math.min(4, -d * 0.5) : d <= 2 ? 2.2 : d <= 7 ? 1.4 : 1;
      const score = Math.round(t.impact * urgency * (t.status === "in_progress" ? 1.1 : 1) * 10) / 10;
      return { id: t.id, title: t.title, score, reason, daysLeft: d };
    })
    .sort((a, b) => b.score - a.score || a.daysLeft - b.daysLeft || a.id.localeCompare(b.id));
}

export function buildState(file: TaskFile, prev: TaskState | null, now: Date): TaskState {
  const t = file.tasks;
  const completed = t.filter((x) => x.status === "done").map((x) => x.id);
  const remaining = t.filter((x) => x.status !== "done").map((x) => x.id);
  const overdue = t.filter((x) => x.status !== "done" && daysLeft(x.due, now) < 0).map((x) => x.id);
  const dueSoon = t.filter((x) => x.status !== "done" && daysLeft(x.due, now) >= 0 && daysLeft(x.due, now) <= 2).map((x) => x.id);
  const blocked = t.filter((x) => x.status === "blocked").map((x) => x.id);
  const prevAll = prev ? new Set([...prev.completed, ...prev.remaining]) : null;
  const delta = {
    newlyCompleted: prev ? completed.filter((id) => !prev.completed.includes(id)) : [],
    newlyAdded: prevAll ? t.map((x) => x.id).filter((id) => !prevAll.has(id)) : [],
    newlyOverdue: prev ? overdue.filter((id) => !prev.overdue.includes(id)) : overdue,
  };
  return { version: 1, generatedAt: now.toISOString(), total: t.length, completed, remaining, overdue, dueSoon, blocked, delta, top: rank(t, now).slice(0, 3) };
}

/** Which proactive events fire now. Morning briefing: 06:00–10:59 in the owner's timezone. */
export function triggers(state: TaskState, now: Date, timezone: string): Trigger[] {
  const out: Trigger[] = [];
  if (state.overdue.length) out.push({ kind: "overdue", taskIds: state.overdue });
  if (state.dueSoon.length) out.push({ kind: "due_soon", taskIds: state.dueSoon });
  if (state.blocked.length) out.push({ kind: "blocked", taskIds: state.blocked });
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  if (hour >= 6 && hour < 11) out.push({ kind: "morning_briefing", taskIds: state.top.map((r) => r.id) });
  return out;
}
