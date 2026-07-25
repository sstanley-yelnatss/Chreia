import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import type { SessionGraph, SessionGraphLane, SessionGraphRow } from "../types";

const ROW_H = 56;
const LANE_W = 48;
const GRAPH_PAD_TOP = 12;
const GRAPH_PAD_X = 16;
/** Shared top chrome so SVG dots stay aligned with list rows. */
const GUTTER_CHROME_H = 52;
const GUTTER_MIN_W = 220;
const REJECT_COLOR = "#f87171";
/**
 * All side branches share one column so the graph doesn’t grow right forever.
 * Col 1 = first-fork offset (same distance rejection_test_A had from main).
 */
const MAIN_VISUAL_COL = 0;
const BRANCH_VISUAL_COL = 1;
const VISUAL_COL_COUNT = BRANCH_VISUAL_COL + 1;

function visualColForLane(laneId: string): number {
  return laneId === "main" ? MAIN_VISUAL_COL : BRANCH_VISUAL_COL;
}

function laneCenterX(laneId: string): number {
  return visualColForLane(laneId) * LANE_W + LANE_W / 2 + GRAPH_PAD_X;
}

const FORK_COLORS = [
  "#a78bfa", // violet
  "#fb923c", // orange
  "#34d399", // emerald
  "#f472b6", // pink
  "#60a5fa", // blue
  "#facc15", // yellow
  "#2dd4bf", // teal
  "#e879f9", // fuchsia
  "#f87171", // red
  "#a3e635", // lime
  "#818cf8", // indigo
  "#fdba74", // peach
  "#4ade80", // green
  "#c084fc", // purple
  "#38bdf8", // sky
  "#f0abfc", // magenta
  "#fbbf24", // amber
  "#67e8f9", // cyan-bright (distinct from main #22d3ee)
  "#fb7185", // rose
  "#bef264", // chartreuse
];

function laneStroke(lane: SessionGraphLane): string {
  if (lane.color_key === "main") return "#22d3ee";
  const m = lane.color_key.match(/^fork_(\d+)$/);
  if (m) return FORK_COLORS[Number(m[1]) % FORK_COLORS.length];
  const mm = lane.color_key.match(/^merged_(\d+)$/);
  if (mm) return FORK_COLORS[Number(mm[1]) % FORK_COLORS.length];
  return "#5c5c6e";
}

function isMergedLane(lane: SessionGraphLane): boolean {
  return lane.status === "merged_confirmed" || lane.status === "merged_rejected";
}

function isRejectedLane(lane: SessionGraphLane): boolean {
  return lane.status === "merged_rejected";
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "checkpoint":
      return "Checkpoint";
    case "branch_fork":
      return "Branch fork";
    case "branch_merge":
      return "Branch merge";
    case "capture_started":
      return "Capture started";
    case "capture_stopped":
      return "Capture stopped";
    case "message_range":
      return "Messages";
    default:
      return kind;
  }
}

function formatTime(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Uniform node size — hollow vs filled carries kind distinction. */
const DOT_R = 5;

/** Quadratic cross-lane arc; control y offset so same-y endpoints stay visible. */
function crossLaneArcPath(xFrom: number, xTo: number, y: number): string {
  const midX = (xFrom + xTo) / 2;
  const controlY = y - ROW_H / 3;
  return `M ${xFrom} ${y} Q ${midX} ${controlY} ${xTo} ${y}`;
}

/**
 * Rejected merge: arc bends toward main but stops short, then a small stub —
 * reads as “abandoned” rather than rejoined.
 */
function rejectedMergeArcPath(xBranch: number, xMain: number, y: number): string {
  const dir = xMain >= xBranch ? 1 : -1;
  const stopX = xMain - dir * (LANE_W * 0.55);
  const midX = (xBranch + stopX) / 2;
  const controlY = y - ROW_H / 3;
  return `M ${xBranch} ${y} Q ${midX} ${controlY} ${stopX} ${y}`;
}

function isRejectedMerge(row: SessionGraphRow, lane: SessionGraphLane): boolean {
  return (
    row.merge_outcome === "rejected" || lane.status === "merged_rejected"
  );
}

function laneStatusHint(lane: SessionGraphLane): string | null {
  if (lane.status === "merged_rejected") return "rejected";
  if (lane.status === "merged_confirmed") return "merged";
  if (lane.status === "active") return "active";
  return null;
}

interface Props {
  graph: SessionGraph;
  selectedRowId: string | null;
  onSelectRow: (row: SessionGraphRow | null) => void;
  onStartCapture: () => void;
}

export default function SessionGraphView({
  graph,
  selectedRowId,
  onSelectRow,
  onStartCapture,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const laneById = useMemo(
    () => new Map(graph.lanes.map((l) => [l.id, l])),
    [graph.lanes],
  );

  // Main first in legend; plot X is shared for all side branches (see BRANCH_VISUAL_COL).
  const lanes = useMemo(() => {
    const rest = graph.lanes.filter((l) => l.id !== "main");
    const main = graph.lanes.find((l) => l.id === "main");
    return main ? [main, ...rest] : rest;
  }, [graph.lanes]);

  const rowCenterY = (rowIndex: number) =>
    rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;

  /**
   * Git Graph–style continuous rails:
   * - main: one spine through the full row stack
   * - every side branch: same X (BRANCH_VISUAL_COL); rails only span their own fork→merge Y range
   */
  const laneLines = useMemo(() => {
    const lines: Array<{
      laneId: string;
      y1: number;
      y2: number;
      x: number;
      style: "main" | "active" | "confirmed" | "rejected";
      color: string;
    }> = [];

    if (graph.rows.length === 0) return lines;

    for (const lane of lanes) {
      const x = laneCenterX(lane.id);

      if (lane.id === "main") {
        lines.push({
          laneId: lane.id,
          y1: rowCenterY(0),
          y2: rowCenterY(graph.rows.length - 1),
          x,
          style: "main",
          color: laneStroke(lane),
        });
        continue;
      }

      const onLane = graph.rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.lane === lane.id);
      if (onLane.length === 0) continue;

      const forkIdx = onLane.find(({ r }) => r.kind === "branch_fork")?.i;
      const mergeIdx = onLane.find(({ r }) => r.kind === "branch_merge")?.i;
      const indices = onLane.map(({ i }) => i);
      const top = Math.min(...indices);
      const bottom = Math.max(...indices);
      const yStart = forkIdx !== undefined ? rowCenterY(forkIdx) : rowCenterY(bottom);
      const yEnd =
        mergeIdx !== undefined
          ? rowCenterY(mergeIdx)
          : rowCenterY(top);

      const y1 = Math.min(yStart, yEnd);
      const y2 = Math.max(yStart, yEnd);
      if (y2 - y1 < 1) continue;

      const style: "active" | "confirmed" | "rejected" = isRejectedLane(lane)
        ? "rejected"
        : lane.status === "merged_confirmed"
          ? "confirmed"
          : "active";

      lines.push({
        laneId: lane.id,
        y1,
        y2,
        x,
        style,
        color: style === "rejected" ? REJECT_COLOR : laneStroke(lane),
      });
    }
    return lines;
  }, [lanes, graph.rows]);

  const branchArcs = useMemo(() => {
    const xMain = laneCenterX("main");
    const arcs: Array<{
      id: string;
      d: string;
      color: string;
      rejected: boolean;
      kind: "fork" | "merge";
    }> = [];

    graph.rows.forEach((row, rowIndex) => {
      if (row.kind !== "branch_fork" && row.kind !== "branch_merge") return;
      if (row.lane === "main") return;

      const lane = laneById.get(row.lane);
      if (!lane) return;

      const xBranch = laneCenterX(row.lane);
      const y = rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;
      const rejected = isRejectedMerge(row, lane);
      const baseColor = laneStroke(lane);

      if (row.kind === "branch_fork") {
        arcs.push({
          id: row.id,
          d: crossLaneArcPath(xMain, xBranch, y),
          color: baseColor,
          rejected: false,
          kind: "fork",
        });
        return;
      }

      arcs.push({
        id: row.id,
        d: rejected
          ? rejectedMergeArcPath(xBranch, xMain, y)
          : crossLaneArcPath(xBranch, xMain, y),
        color: rejected ? REJECT_COLOR : baseColor,
        rejected,
        kind: "merge",
      });
    });

    return arcs;
  }, [graph.rows, laneById]);

  const rejectMarkers = useMemo(() => {
    const markers: Array<{
      id: string;
      cx: number;
      cy: number;
      row: SessionGraphRow;
    }> = [];
    graph.rows.forEach((row, rowIndex) => {
      if (row.kind !== "branch_merge" || row.lane === "main") return;
      const lane = laneById.get(row.lane);
      if (!lane || !isRejectedMerge(row, lane)) return;
      const xMain = laneCenterX("main");
      const xBranch = laneCenterX(row.lane);
      const dir = xMain >= xBranch ? 1 : -1;
      const cx = xMain - dir * (LANE_W * 0.55);
      const cy = rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;
      markers.push({ id: row.id, cx, cy, row });
    });
    return markers;
  }, [graph.rows, laneById]);

  const selectRow = (row: SessionGraphRow) => {
    onSelectRow(selectedRowId === row.id ? null : row);
  };
  const hoveredRow = graph.rows.find((r) => r.id === hoveredId) ?? null;
  const hoveredLane = hoveredRow ? laneById.get(hoveredRow.lane) : undefined;

  if (graph.empty) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          No capture session yet. Start capture to record chat and build a session graph with
          checkpoints and branches.
        </p>
        <button type="button" onClick={onStartCapture} className="cl-btn-accent cl-btn-toolbar">
          <Zap size={13} />
          Start capture
        </button>
      </div>
    );
  }

  const graphWidth = VISUAL_COL_COUNT * LANE_W + GRAPH_PAD_X * 2;
  const graphHeight = graph.rows.length * ROW_H + GRAPH_PAD_TOP * 2;
  const gutterWidth = Math.max(graphWidth + 32, GUTTER_MIN_W);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Full-width lane legend — not constrained to the graph gutter. */}
      <div
        className="z-20 flex shrink-0 flex-col justify-center gap-1.5 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm"
        style={{ minHeight: GUTTER_CHROME_H }}
      >
        <div className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground">
          Lanes
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {lanes.map((lane) => {
            const hint = laneStatusHint(lane);
            const rejected = isRejectedLane(lane);
            return (
              <div
                key={lane.id}
                className="flex items-center gap-1.5 font-mono-ui text-[10px] text-muted-foreground"
                title={lane.label}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: rejected ? REJECT_COLOR : laneStroke(lane),
                    opacity: isMergedLane(lane) && !rejected ? 0.55 : 0.95,
                  }}
                />
                <span className="whitespace-nowrap">{lane.label}</span>
                {hint && (
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{
                      color: rejected ? REJECT_COLOR : undefined,
                      opacity: rejected ? 1 : 0.7,
                    }}
                  >
                    · {hint}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cl-scroll-y-left min-h-0 flex-1 overflow-y-auto">
        <div className="cl-scroll-y-left-inner flex">
          <div
            className="sticky left-0 z-10 flex max-w-[42vw] shrink-0 flex-col border-r border-border bg-background/95 backdrop-blur-sm"
            style={{ width: gutterWidth }}
          >
            <div className="min-w-0 overflow-x-auto px-1 pt-1">
              <svg width={graphWidth} height={graphHeight} className="block" aria-hidden>
                {laneLines.map((line, i) => (
                  <line
                    key={`${line.laneId}-${i}`}
                    x1={line.x}
                    y1={line.y1}
                    x2={line.x}
                    y2={line.y2}
                    stroke={line.color}
                    strokeWidth={line.style === "main" ? 3.25 : 2.85}
                    strokeOpacity={
                      line.style === "main"
                        ? 0.8
                        : line.style === "rejected"
                          ? 0.6
                          : line.style === "confirmed"
                            ? 0.55
                            : 0.75
                    }
                    strokeDasharray={
                      line.style === "active"
                        ? "6 4"
                        : line.style === "rejected"
                          ? "4 4"
                          : undefined
                    }
                    strokeLinecap="round"
                  />
                ))}
                {branchArcs.map((arc) => (
                  <path
                    key={`arc-${arc.id}`}
                    d={arc.d}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={arc.rejected ? 2.75 : 2.6}
                    strokeOpacity={arc.rejected ? 0.9 : 0.7}
                    strokeDasharray={arc.rejected ? "4 3" : undefined}
                    strokeLinecap="round"
                  />
                ))}
                {/* Filled junction dots on main where a branch forks off */}
                {graph.rows.map((row, rowIndex) => {
                  if (row.kind !== "branch_fork" || row.lane === "main") return null;
                  const lane = laneById.get(row.lane);
                  if (!lane) return null;
                  const xMain = laneCenterX("main");
                  const cy = rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;
                  const color = laneStroke(lane);
                  const selected = selectedRowId === row.id;
                  const hovered = hoveredId === row.id;
                  const baseR = DOT_R;
                  const r = selected || hovered ? baseR + 2 : baseR;
                  return (
                    <g
                      key={`fork-junction-${row.id}`}
                      aria-label={`Open ${lane.label} fork`}
                      style={{ cursor: "pointer", outline: "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRow(row);
                      }}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() =>
                        setHoveredId((id) => (id === row.id ? null : id))
                      }
                    >
                      <circle cx={xMain} cy={cy} r={r + 4} fill="transparent" />
                      <circle
                        cx={xMain}
                        cy={cy}
                        r={r}
                        fill={color}
                        stroke="var(--background, #0c0c0f)"
                        strokeWidth={2}
                        fillOpacity={0.95}
                      />
                    </g>
                  );
                })}
                {rejectMarkers.map((m) => {
                  const selected = selectedRowId === m.row.id;
                  const hovered = hoveredId === m.row.id;
                  const baseR = DOT_R;
                  const r = selected || hovered ? baseR + 2 : baseR;
                  const s = r * 0.65;
                  return (
                    <g
                      key={`reject-${m.id}`}
                      aria-label="Open rejected merge"
                      style={{ cursor: "pointer", outline: "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRow(m.row);
                      }}
                      onMouseEnter={() => setHoveredId(m.row.id)}
                      onMouseLeave={() =>
                        setHoveredId((id) => (id === m.row.id ? null : id))
                      }
                    >
                      <circle cx={m.cx} cy={m.cy} r={r + 6} fill="transparent" />
                      <circle
                        cx={m.cx}
                        cy={m.cy}
                        r={r}
                        fill="var(--background, #0c0c10)"
                        stroke={REJECT_COLOR}
                        strokeWidth={2}
                        strokeOpacity={0.9}
                      />
                      <path
                        d={`M ${m.cx - s} ${m.cy - s} L ${m.cx + s} ${m.cy + s} M ${m.cx + s} ${m.cy - s} L ${m.cx - s} ${m.cy + s}`}
                        stroke={REJECT_COLOR}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
                {/* Confirmed merges land on main (dot on spine where the arc rejoins). */}
                {graph.rows.map((row, rowIndex) => {
                  if (row.kind !== "branch_merge" || row.lane === "main") return null;
                  const lane = laneById.get(row.lane);
                  if (!lane || isRejectedMerge(row, lane)) return null;
                  const xMain = laneCenterX("main");
                  const cy = rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;
                  const color = laneStroke(lane);
                  const selected = selectedRowId === row.id;
                  const hovered = hoveredId === row.id;
                  const baseR = DOT_R;
                  const r = selected || hovered ? baseR + 2 : baseR;
                  return (
                    <g
                      key={`merge-main-${row.id}`}
                      aria-label={`Open ${lane.label} merge`}
                      style={{ cursor: "pointer", outline: "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRow(row);
                      }}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() =>
                        setHoveredId((id) => (id === row.id ? null : id))
                      }
                    >
                      <circle cx={xMain} cy={cy} r={r + 5} fill="transparent" />
                      <circle
                        cx={xMain}
                        cy={cy}
                        r={r}
                        fill={color}
                        stroke="var(--background, #0c0c0f)"
                        strokeWidth={2}
                        fillOpacity={0.95}
                      />
                    </g>
                  );
                })}
                {graph.rows.map((row, rowIndex) => {
                  const lane = laneById.get(row.lane);
                  if (!lane) return null;
                  const cx = laneCenterX(row.lane);
                  const cy = rowIndex * ROW_H + ROW_H / 2 + GRAPH_PAD_TOP;
                  const baseR = DOT_R;
                  const rejected = isRejectedLane(lane);
                  const confirmed = lane.status === "merged_confirmed";
                  const color = rejected ? REJECT_COLOR : laneStroke(lane);
                  const selected = selectedRowId === row.id;
                  const hovered = hoveredId === row.id;
                  const r = selected || hovered ? baseR + 2 : baseR;
                  // Merges render on main (or as reject ✕) — skip branch-column merge dots.
                  if (row.kind === "branch_merge") return null;
                  const isFork = row.kind === "branch_fork";
                  const hollow = row.kind === "message_range";

                  return (
                    <g
                      key={row.id}
                      aria-label={`Open ${kindLabel(row.kind)}`}
                      style={{ cursor: "pointer", outline: "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRow(row);
                      }}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() =>
                        setHoveredId((id) => (id === row.id ? null : id))
                      }
                    >
                      <circle cx={cx} cy={cy} r={Math.max(r + 6, 12)} fill="transparent" />
                      {row.is_active_head && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r + 5}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth={1.75}
                          strokeOpacity={0.65}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={hollow ? "none" : color}
                        stroke={color}
                        strokeWidth={hollow ? 2.25 : isFork ? 2 : rejected || confirmed ? 1.75 : 0}
                        strokeOpacity={rejected ? 0.85 : confirmed ? 0.55 : 1}
                        strokeDasharray={
                          rejected && !hollow && !isFork ? "2 2" : undefined
                        }
                        fillOpacity={
                          hollow
                            ? 1
                            : isFork
                              ? 1
                              : rejected
                                ? 0.35
                                : confirmed
                                  ? 0.55
                                  : 0.95
                        }
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="min-w-0 flex-1 pb-4 pt-1">
            {graph.rows.map((row) => {
              const selected = selectedRowId === row.id;
              const lane = laneById.get(row.lane);
              const rejected =
                row.merge_outcome === "rejected" ||
                (lane ? isRejectedLane(lane) && row.kind === "branch_merge" : false);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectRow(selected ? null : row)}
                  onMouseEnter={() => setHoveredId(row.id)}
                  onMouseLeave={() => setHoveredId((id) => (id === row.id ? null : id))}
                  className={`flex h-14 w-full items-center gap-3 border-b border-border/60 px-4 text-left transition-colors ${
                    selected
                      ? "bg-[rgba(34,211,238,0.08)]"
                      : "hover:bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-ui text-[10px] uppercase tracking-wide text-muted-foreground">
                        {kindLabel(row.kind)}
                      </span>
                      {lane && (
                        <span
                          className="font-mono-ui rounded-[3px] px-1.5 py-0.5 text-[10px]"
                          style={{
                            background: `${rejected ? REJECT_COLOR : laneStroke(lane)}18`,
                            color: rejected ? REJECT_COLOR : laneStroke(lane),
                          }}
                        >
                          {lane.label}
                        </span>
                      )}
                      {rejected && (
                        <span
                          className="font-mono-ui text-[10px] uppercase"
                          style={{ color: REJECT_COLOR }}
                        >
                          Rejected
                        </span>
                      )}
                      {row.message_count > 0 && (
                        <span className="font-mono-ui text-[10px] text-muted-foreground">
                          {row.message_count} msg{row.message_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {row.primary_label}
                    </p>
                    {row.secondary_label && (
                      <p className="truncate text-xs text-muted-foreground">{row.secondary_label}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono-ui text-[10px] text-muted-foreground/80">
                    {formatTime(row.at)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hoveredRow && (
        <div
          className="pointer-events-none absolute right-4 top-4 z-20 max-w-xs rounded-[3px] border border-border bg-card px-3 py-2 shadow-lg"
          role="tooltip"
        >
          <p className="font-mono-ui text-[10px] uppercase tracking-wide text-muted-foreground">
            {kindLabel(hoveredRow.kind)}
            {hoveredLane ? ` · ${hoveredLane.label}` : ""}
            {hoveredRow.merge_outcome === "rejected" ? " · rejected" : ""}
          </p>
          <p className="mt-1 text-xs text-foreground">{formatTime(hoveredRow.at)}</p>
          {hoveredRow.message_count > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {hoveredRow.message_count} message{hoveredRow.message_count === 1 ? "" : "s"}
            </p>
          )}
          {hoveredRow.note && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{hoveredRow.note}</p>
          )}
          {(hoveredRow.linked_block_ids?.length ?? 0) > 0 && (
            <p className="mt-1 font-mono-ui text-[10px] text-muted-foreground">
              {hoveredRow.linked_block_ids!.length} linked block
              {hoveredRow.linked_block_ids!.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
