import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { formatLaneThread, type LaneThreadMessage } from "../lib/formatLaneThread";

interface Props {
  laneLabel: string;
  /** Load messages for this lane (already scoped). */
  loadMessages: () => Promise<LaneThreadMessage[]>;
}

export default function LaneCopyThreadButton({ laneLabel, loadMessages }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"thread" | "raw" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  async function copy(raw: boolean) {
    if (busy) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      const messages = await loadMessages();
      const text = formatLaneThread(messages, {
        laneLabel,
        toolMaxChars: raw ? null : undefined,
      });
      await navigator.clipboard.writeText(text);
      setCopied(raw ? "raw" : "thread");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative ml-0.5 flex items-center">
      <div className="flex items-stretch overflow-hidden rounded-[3px] border border-border/80">
        <button
          type="button"
          disabled={busy}
          onClick={() => void copy(false)}
          className="flex cursor-pointer items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-[rgba(255,255,255,0.05)] hover:text-foreground disabled:opacity-50"
          title={`Copy ${laneLabel} thread (tools truncated)`}
        >
          {copied === "thread" ? (
            <Check size={10} className="text-accent" />
          ) : (
            <Copy size={10} />
          )}
          <span className="whitespace-nowrap">
            {copied === "thread" ? "Copied" : "Copy thread"}
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex cursor-pointer items-center border-l border-border/80 px-1 text-muted-foreground hover:bg-[rgba(255,255,255,0.05)] hover:text-foreground disabled:opacity-50"
          aria-label={`More copy options for ${laneLabel}`}
          aria-expanded={menuOpen}
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {menuOpen && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-[9.5rem] rounded-[3px] border border-border bg-card py-1 shadow-lg">
          <button
            type="button"
            onClick={() => void copy(true)}
            className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] text-foreground hover:bg-[rgba(255,255,255,0.05)]"
          >
            {copied === "raw" ? <Check size={10} className="text-accent" /> : <Copy size={10} />}
            Copy raw
          </button>
        </div>
      )}
    </div>
  );
}
