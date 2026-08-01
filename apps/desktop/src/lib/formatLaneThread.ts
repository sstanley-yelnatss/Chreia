/** Format a lane's capture log for paste into another LLM. */

export type LaneThreadMessage = {
  seq: number;
  role: string;
  content: string;
};

/** Soft cap for tool bodies in the default (non-raw) copy. */
export const DEFAULT_TOOL_MAX_CHARS = 3500;

function roleHeading(role: string): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "tool":
      return "Tool";
    case "system":
      return "System";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function truncateBody(content: string, maxChars: number): { text: string; truncated: boolean } {
  if (content.length <= maxChars) return { text: content, truncated: false };
  const kept = content.slice(0, maxChars).trimEnd();
  return {
    text: `${kept}\n\n[truncated — ${content.length} chars total; use Copy raw for full]`,
    truncated: true,
  };
}

export function formatLaneThread(
  messages: LaneThreadMessage[],
  opts: { laneLabel: string; toolMaxChars?: number | null },
): string {
  const toolMax = opts.toolMaxChars === undefined ? DEFAULT_TOOL_MAX_CHARS : opts.toolMaxChars;
  const sorted = [...messages].sort((a, b) => a.seq - b.seq);

  const parts: string[] = [
    `# Lane: ${opts.laneLabel}`,
    "",
    "Session thread (user + assistant + tool). Paste into another LLM to continue.",
    "",
  ];

  if (sorted.length === 0) {
    parts.push("(no messages on this lane)");
    return parts.join("\n");
  }

  for (const m of sorted) {
    const body = (m.content ?? "").trim() || "(empty)";
    const shouldTruncate = toolMax != null && m.role === "tool";
    const { text } = shouldTruncate ? truncateBody(body, toolMax) : { text: body };
    parts.push(`${roleHeading(m.role)}:`);
    parts.push(text);
    parts.push("");
  }

  return parts.join("\n").trimEnd() + "\n";
}

export function laneSeqRange(
  rows: Array<{ lane: string; log_from_seq: number; log_to_seq: number }>,
  laneId: string,
): { from: number; to: number } | null {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.lane !== laneId) continue;
    if (row.log_from_seq > row.log_to_seq) continue;
    from = Math.min(from, row.log_from_seq);
    to = Math.max(to, row.log_to_seq);
  }
  if (!Number.isFinite(from) || to < from) return null;
  return { from, to };
}

export function collectLaneMessagesFromSlices(
  rows: Array<{ lane: string; log_from_seq: number; log_to_seq: number }>,
  messageSlices: Record<string, LaneThreadMessage[]>,
  laneId: string,
): LaneThreadMessage[] {
  const bySeq = new Map<number, LaneThreadMessage>();
  for (const row of rows) {
    if (row.lane !== laneId) continue;
    if (row.log_from_seq > row.log_to_seq) continue;
    const key = `${laneId}:${row.log_from_seq}-${row.log_to_seq}`;
    const msgs = messageSlices[key] ?? [];
    for (const m of msgs) bySeq.set(m.seq, m);
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
