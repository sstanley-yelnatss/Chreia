import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Trash2, X } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  deleteShareHistory,
  listShareHistory,
  type ShareHistoryEntry,
} from "../api";

interface Props {
  open: boolean;
  workspaceId?: string;
  workspaceName?: string;
  onClose: () => void;
  onToast?: (message: string) => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function ShareHistoryDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
  onToast,
}: Props) {
  const [entries, setEntries] = useState<ShareHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thisWorkspaceOnly, setThisWorkspaceOnly] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listShareHistory({
        workspaceId: thisWorkspaceOnly && workspaceId ? workspaceId : null,
        limit: 200,
      });
      setEntries(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [thisWorkspaceOnly, workspaceId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function copy(key: string, text: string, label: string) {
    try {
      await writeText(text);
      setCopied(key);
      onToast?.(`Copied ${label}`);
      window.setTimeout(() => setCopied(null), 1400);
    } catch (e) {
      onToast?.(String(e));
    }
  }

  async function remove(id: string) {
    try {
      await deleteShareHistory(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      onToast?.("Removed from local history");
    } catch (e) {
      onToast?.(String(e));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-history-title"
        className="cl-dialog flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 id="share-history-title" className="text-base font-medium text-foreground">
              Recent shares
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Local history only — passwords are saved on this machine so you can match them to
              each link. Chreia servers store a hash, not your password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-[3px] p-1 text-muted-foreground hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {workspaceId && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={thisWorkspaceOnly}
              onChange={(e) => setThisWorkspaceOnly(e.target.checked)}
              className="rounded border-border"
            />
            This workspace only
            {workspaceName ? ` (${workspaceName})` : ""}
          </label>
        )}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="text-sm" style={{ color: "var(--hygiene-warn)" }}>
              {error}
            </p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No published shares yet. Publish a session trace to add one.
            </p>
          )}
          <ul className="space-y-2">
            {entries.map((entry) => {
              const showPw = Boolean(revealed[entry.id]);
              return (
                <li
                  key={entry.id}
                  className="rounded-[3px] border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {entry.workspace_name}
                      </p>
                      <p className="font-mono-ui mt-0.5 text-[10px] text-muted-foreground">
                        {formatWhen(entry.published_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(entry.id)}
                      className="shrink-0 cursor-pointer rounded-[3px] p-1 text-muted-foreground hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground"
                      title="Remove from local history"
                      aria-label="Remove from local history"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                    {entry.url}
                  </p>

                  {entry.password_set && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono-ui text-[10px] uppercase text-muted-foreground">
                        Password
                      </span>
                      <code className="font-mono text-[11px] text-foreground">
                        {showPw ? entry.password || "(missing)" : "••••••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                        }
                        className="cursor-pointer rounded-[3px] p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <CopyChip
                      active={copied === `${entry.id}:url`}
                      label="Copy link"
                      onClick={() => void copy(`${entry.id}:url`, entry.url, "link")}
                    />
                    {entry.password_set && entry.password && (
                      <CopyChip
                        active={copied === `${entry.id}:pw`}
                        label="Copy password"
                        onClick={() =>
                          void copy(`${entry.id}:pw`, entry.password!, "password")
                        }
                      />
                    )}
                    {entry.receipt_markdown.trim() && (
                      <CopyChip
                        active={copied === `${entry.id}:receipt`}
                        label="Copy receipt"
                        onClick={() =>
                          void copy(
                            `${entry.id}:receipt`,
                            entry.receipt_markdown,
                            "receipt",
                          )
                        }
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 flex shrink-0 justify-end">
          <button type="button" onClick={onClose} className="cl-btn-ghost px-3 py-2 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyChip({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-[3px] border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-[rgba(255,255,255,0.05)] hover:text-foreground"
    >
      {active ? <Check size={10} className="text-accent" /> : <Copy size={10} />}
      {active ? "Copied" : label}
    </button>
  );
}
