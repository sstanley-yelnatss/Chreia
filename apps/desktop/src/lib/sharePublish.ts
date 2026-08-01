import {
  exportPrReasoning,
  fetchSessionGraph,
  fetchSessionLogSlice,
  type TraceLogSlice,
} from "../api";
import type { CaptureLogMessage, SessionGraph, Workspace } from "../types";

/** Mirrors site `ShareSnapshot` schema_version 1 */
export type ShareSnapshot = {
  schema_version: 1;
  published_at: string;
  workspace: { id: string; name: string; goal: string };
  receipt_markdown: string;
  session_graph: SessionGraph;
  message_slices: Record<string, CaptureLogMessage[]>;
  trace_options: {
    checkpoints: boolean;
    raw_log: boolean;
    branch_logs: boolean;
    log_slice: string;
  };
};

export type PublishShareResult = {
  token: string;
  url: string;
  password: string | null;
  password_set: boolean;
  expires_at: string | null;
};

const DEFAULT_PUBLIC_URL = "https://chreia.vercel.app";

export function getChreiaPublicUrl(): string {
  const fromVite = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_CHREIA_PUBLIC_URL;
  const raw = (fromVite || DEFAULT_PUBLIC_URL).trim().replace(/\/+$/, "");
  return raw || DEFAULT_PUBLIC_URL;
}

export function getSharePublishKey(): string | null {
  const fromVite = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_CHREIA_SHARE_PUBLISH_KEY;
  const key = fromVite?.trim();
  return key || null;
}

function sliceKey(lane: string, from: number, to: number): string {
  return `${lane}:${from}-${to}`;
}

export async function buildShareSnapshot(args: {
  workspace: Workspace;
  blockIds: string[];
  includeTraceCheckpoints: boolean;
  includeTraceLog: boolean;
  includeTraceBranchLogs: boolean;
  traceLogSlice: TraceLogSlice;
  prNumber?: string;
}): Promise<ShareSnapshot> {
  // Receipt only — trail lives on the hosted viewer, not inlined in the PR body.
  const receipt_markdown = await exportPrReasoning(args.workspace.id, args.blockIds, {
    includeTrace: false,
    prNumber: args.prNumber,
  });

  const session_graph = await fetchSessionGraph(args.workspace.id);
  const message_slices: Record<string, CaptureLogMessage[]> = {};

  const wantMessages = args.includeTraceLog || args.includeTraceBranchLogs;
  if (wantMessages && !session_graph.empty) {
    const rows = session_graph.rows.filter(
      (r) =>
        r.message_count > 0 &&
        r.log_from_seq <= r.log_to_seq &&
        (r.lane === "main" ? args.includeTraceLog : args.includeTraceBranchLogs),
    );
    // Cap concurrent fetches
    const limited = rows.slice(0, 40);
    await Promise.all(
      limited.map(async (row) => {
        try {
          const msgs = await fetchSessionLogSlice({
            workspaceId: args.workspace.id,
            fromSeq: row.log_from_seq,
            toSeq: row.log_to_seq,
            branch: row.lane === "main" ? null : row.lane,
          });
          message_slices[sliceKey(row.lane, row.log_from_seq, row.log_to_seq)] = msgs;
        } catch {
          /* skip failed slices */
        }
      }),
    );
  }

  return {
    schema_version: 1,
    published_at: new Date().toISOString(),
    workspace: {
      id: args.workspace.id,
      name: args.workspace.name,
      goal: args.workspace.goal,
    },
    receipt_markdown,
    session_graph,
    message_slices,
    trace_options: {
      checkpoints: args.includeTraceCheckpoints,
      raw_log: args.includeTraceLog,
      branch_logs: args.includeTraceBranchLogs,
      log_slice: args.traceLogSlice,
    },
  };
}

export function composePrClipboard(receiptMarkdown: string, traceUrl: string): string {
  const traceSection = `\n\n---\n\n## Session trace\n\nFull capture (graph + logs): ${traceUrl}\n`;
  // Insert before final attribution footer if present
  const footerMarker = "\n---\n\nReasoning appendix by";
  const idx = receiptMarkdown.lastIndexOf(footerMarker);
  if (idx >= 0) {
    return `${receiptMarkdown.slice(0, idx)}${traceSection}${receiptMarkdown.slice(idx)}`;
  }
  return `${receiptMarkdown.trimEnd()}${traceSection}`;
}

export async function publishShareTrail(args: {
  snapshot: ShareSnapshot;
  password?: string | null;
  generatePassword?: boolean;
}): Promise<PublishShareResult> {
  const base = getChreiaPublicUrl();
  const key = getSharePublishKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(`${base}/api/shares/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      snapshot: args.snapshot,
      password: args.password ?? null,
      generate_password: Boolean(args.generatePassword),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Publish failed (${res.status})`,
    );
  }
  return {
    token: data.token,
    url: data.url,
    password: data.password ?? null,
    password_set: Boolean(data.password_set),
    expires_at: data.expires_at ?? null,
  };
}
