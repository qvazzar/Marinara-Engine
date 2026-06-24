import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Trash2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import type { ScheduleBlock, WeekSchedule } from "@marinara-engine/shared";
import { CONVERSATION_SCHEDULE_DAYS } from "@marinara-engine/shared";

const STATUS_OPTIONS: ScheduleBlock["status"][] = ["online", "idle", "dnd", "offline"];
const STATUS_COLORS: Record<ScheduleBlock["status"], string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};
const AUTONOMOUS_DAILY_CAP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const CURRENT_SCHEDULE_DAY = CONVERSATION_SCHEDULE_DAYS[(new Date().getDay() + 6) % 7];
const CURRENT_SCHEDULE_MINUTES = new Date().getHours() * 60 + new Date().getMinutes();
const RULER_HOURS = Array.from({ length: 25 }, (_, hour) => hour);

type StatusMenuState = {
  key: string;
};

function parseScheduleMinutes(value: string) {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function parseScheduleRange(value: string) {
  const [startRaw, endRaw] = value.split("-");
  const start = parseScheduleMinutes(startRaw ?? "");
  const end = parseScheduleMinutes(endRaw ?? "");
  if (start == null || end == null) return null;

  const normalizedEnd = end === 0 && start > 0 ? 1440 : end;
  if (normalizedEnd <= start) return null;

  return { start, end: normalizedEnd };
}

function statusLabel(status?: ScheduleBlock["status"]) {
  return status === "offline" ? "Offline" : status === "dnd" ? "Busy" : status === "idle" ? "Away" : "Online";
}

function getMonday(date: Date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function createEmptySchedule(): WeekSchedule {
  return {
    weekStart: getMonday().toISOString(),
    days: {},
    inactivityThresholdMinutes: 120,
    talkativeness: 50,
  };
}

interface CharacterScheduleEditorModalProps {
  open: boolean;
  characterId: string | null;
  characterName: string;
  schedule?: WeekSchedule;
  initialDay?: string | null;
  onClose: () => void;
  onSave: (characterId: string, updated: WeekSchedule) => void;
}

export function CharacterScheduleEditorModal({
  open,
  characterId,
  characterName,
  schedule,
  initialDay,
  onClose,
  onSave,
}: CharacterScheduleEditorModalProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeekSchedule | null>(null);
  const [inactivityThresholdMinutes, setInactivityThresholdMinutes] = useState("120");
  const [idleResponseDelayMinutes, setIdleResponseDelayMinutes] = useState("");
  const [dndResponseDelayMinutes, setDndResponseDelayMinutes] = useState("");
  const [autonomousDailyCapOverride, setAutonomousDailyCapOverride] = useState("");
  const [statusMenu, setStatusMenu] = useState<StatusMenuState | null>(null);

  useEffect(() => {
    if (!open || !characterId) return;
    const nextDraft = schedule
      ? {
          ...schedule,
          days: JSON.parse(JSON.stringify(schedule.days)),
        }
      : createEmptySchedule();
    setDraft(nextDraft);
    setInactivityThresholdMinutes(String(nextDraft.inactivityThresholdMinutes));
    setIdleResponseDelayMinutes(
      typeof nextDraft.idleResponseDelayMinutes === "number" ? String(nextDraft.idleResponseDelayMinutes) : "",
    );
    setDndResponseDelayMinutes(
      typeof nextDraft.dndResponseDelayMinutes === "number" ? String(nextDraft.dndResponseDelayMinutes) : "",
    );
    setAutonomousDailyCapOverride(
      typeof nextDraft.autonomousDailyCapOverride === "number" ? String(nextDraft.autonomousDailyCapOverride) : "",
    );
    setExpandedDay(initialDay ?? null);
  }, [characterId, initialDay, open, schedule]);

  const parseRequiredMinutes = useCallback((value: string, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }, []);

  const parseOptionalMinutes = useCallback((value: string, min: number, max: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(min, Math.min(max, parsed));
  }, []);

  const parseOptionalCap = useCallback((value: string, min: number, max: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }, []);

  const updateBlock = useCallback((day: string, idx: number, field: keyof ScheduleBlock, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, days: { ...current.days } };
      const dayBlocks = [...(next.days[day] ?? [])];
      dayBlocks[idx] = { ...dayBlocks[idx]!, [field]: value };
      next.days[day] = dayBlocks;
      return next;
    });
  }, []);

  const addBlock = useCallback((day: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, days: { ...current.days } };
      const dayBlocks = [...(next.days[day] ?? [])];
      dayBlocks.push({ time: "12:00-13:00", activity: "Free time", status: "online" });
      next.days[day] = dayBlocks;
      return next;
    });
  }, []);

  const removeBlock = useCallback((day: string, idx: number) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, days: { ...current.days } };
      const dayBlocks = [...(next.days[day] ?? [])];
      dayBlocks.splice(idx, 1);
      next.days[day] = dayBlocks;
      return next;
    });
  }, []);

  const toggleStatusMenu = useCallback(
    (key: string) => {
      setStatusMenu((current) => (current?.key === key ? null : { key }));
    },
    [],
  );

  const selectBlockStatus = useCallback(
    (menuKey: string, status: ScheduleBlock["status"]) => {
      const [day, idxString] = menuKey.split(":");
      const idx = Number(idxString);
      if (!day || !Number.isInteger(idx)) return;
      updateBlock(day, idx, "status", status);
      setStatusMenu(null);
    },
    [updateBlock],
  );

  const handleSave = useCallback(() => {
    if (!characterId || !draft) return;
    const parsedAutonomousDailyCap = parseOptionalCap(autonomousDailyCapOverride, 1, 8);
    const nextDraft: WeekSchedule = {
      ...draft,
      inactivityThresholdMinutes: parseRequiredMinutes(
        inactivityThresholdMinutes,
        draft.inactivityThresholdMinutes,
        15,
        360,
      ),
      ...(parseOptionalMinutes(idleResponseDelayMinutes, 0, 120) === undefined
        ? {}
        : { idleResponseDelayMinutes: parseOptionalMinutes(idleResponseDelayMinutes, 0, 120) }),
      ...(parseOptionalMinutes(dndResponseDelayMinutes, 0, 120) === undefined
        ? {}
        : { dndResponseDelayMinutes: parseOptionalMinutes(dndResponseDelayMinutes, 0, 120) }),
      ...(parsedAutonomousDailyCap === undefined ? {} : { autonomousDailyCapOverride: parsedAutonomousDailyCap }),
    };
    onSave(characterId, nextDraft);
    onClose();
  }, [
    autonomousDailyCapOverride,
    characterId,
    dndResponseDelayMinutes,
    draft,
    idleResponseDelayMinutes,
    inactivityThresholdMinutes,
    onClose,
    onSave,
    parseOptionalCap,
    parseOptionalMinutes,
    parseRequiredMinutes,
  ]);

  const totalBlocks = draft ? Object.values(draft.days).reduce((count, blocks) => count + blocks.length, 0) : 0;
  const scheduledDays = draft ? Object.values(draft.days).filter((blocks) => blocks.length > 0).length : 0;
  const hasAnyBlocks = totalBlocks > 0;

  const renderBlockEditor = (day: string, block: ScheduleBlock, idx: number) => (
    <div
      key={`${day}-${idx}-${block.time}`}
      className="relative rounded-2xl border border-[var(--border)]/65 bg-[var(--foreground)]/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex shrink-0 flex-row items-start gap-1.5 md:flex-col md:pt-0.5">
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={`Change status: ${statusLabel(block.status)}`}
              title="Change status"
              className="mari-chrome-control mari-chrome-control--small min-w-0 shrink-0 px-2 py-1.5 max-md:h-9 max-md:min-h-9"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                toggleStatusMenu(`${day}:${idx}`);
              }}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_COLORS[block.status])} />
              <span className="mari-chrome-text max-w-20 truncate text-xs">{statusLabel(block.status)}</span>
            </button>

            {statusMenu?.key === `${day}:${idx}` ? (
              <div
                role="menu"
                aria-label="Change block status"
                className="absolute left-0 top-full z-[20] mt-1 min-w-[10.5rem] rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {STATUS_OPTIONS.map((status) => {
                  const selected = block.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectBlockStatus(`${day}:${idx}`, status);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.6875rem] transition-colors",
                        selected ? "bg-[var(--accent)] text-[var(--foreground)]" : "text-[var(--popover-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_COLORS[status])} />
                      <span>{statusLabel(status)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <input
            value={block.time}
            onChange={(e) => updateBlock(day, idx, "time", e.target.value)}
            className="mari-chrome-control mari-chrome-control--small w-[7.25rem] min-w-0 shrink-0 px-2 py-1.5 text-center text-xs tabular-nums max-md:h-9 max-md:min-h-9"
            placeholder="06:00-08:00"
          />
        </div>
        <textarea
          value={block.activity}
          onChange={(e) => updateBlock(day, idx, "activity", e.target.value)}
          rows={2}
          className="mari-chrome-field min-h-[4rem] min-w-0 flex-1 resize-none px-3 py-2 text-[0.625rem] leading-5"
          placeholder="Activity description"
        />
        <button
          type="button"
          onClick={() => removeBlock(day, idx)}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] max-md:absolute max-md:right-3 max-md:top-3 md:mt-0.5"
          title="Delete block"
        >
          <Trash2 size="0.7rem" />
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${characterName} Schedule`}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      width="max-w-5xl"
      mobileFullScreen
    >
      {!draft ? null : (
        <div className="space-y-4">
          <section className="rounded-md border border-[var(--border)]/75 bg-[var(--foreground)]/[0.03] px-3 py-3 transition-colors hover:bg-[var(--foreground)]/[0.05]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="text-[0.9rem] font-semibold text-[var(--foreground)]">{characterName}</h3>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--foreground)]/8 px-2.5 py-1 text-[0.5625rem] font-medium text-[var(--foreground)]/82 ring-1 ring-[var(--border)]/45">
                  {scheduledDays} day{scheduledDays === 1 ? "" : "s"} active
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--foreground)]/8 px-2.5 py-1 text-[0.5625rem] font-medium text-[var(--foreground)]/82 ring-1 ring-[var(--border)]/45">
                  {totalBlocks} block{totalBlocks === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--foreground)]/8 px-2.5 py-1 text-[0.5625rem] font-medium text-[var(--foreground)]/82 ring-1 ring-[var(--border)]/45">
                  {hasAnyBlocks ? "Schedule drafted" : "No blocks yet"}
                </span>
              </div>
            </div>

          </section>

          <section className="rounded-md border border-[var(--border)]/75 bg-[var(--foreground)]/[0.03] p-3 transition-colors hover:bg-[var(--foreground)]/[0.045]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 rounded-md border border-[var(--border)]/55 bg-[var(--background)]/72 px-3 py-2.5">
                <span className="block text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/78">
                  Inactivity threshold
                </span>
                <input
                  type="number"
                  min={15}
                  max={360}
                  step={5}
                  value={inactivityThresholdMinutes}
                  onChange={(e) => setInactivityThresholdMinutes(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/20"
                />
                </label>

              <label className="space-y-1.5 rounded-md border border-[var(--border)]/55 bg-[var(--background)]/72 px-3 py-2.5">
                <span className="block text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/78">
                  Idle delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={idleResponseDelayMinutes}
                  onChange={(e) => setIdleResponseDelayMinutes(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/20"
                  placeholder="Default"
                />
              </label>

              <label className="space-y-1.5 rounded-md border border-[var(--border)]/55 bg-[var(--background)]/72 px-3 py-2.5">
                <span className="block text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/78">
                  DND delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={dndResponseDelayMinutes}
                  onChange={(e) => setDndResponseDelayMinutes(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/20"
                  placeholder="Default"
                />
              </label>

              <label className="space-y-1.5 rounded-md border border-[var(--border)]/55 bg-[var(--background)]/72 px-3 py-2.5">
                <span className="block text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/78">
                  Check-in cap
                </span>
                <select
                  value={autonomousDailyCapOverride}
                  onChange={(e) => setAutonomousDailyCapOverride(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  <option value="">Default</option>
                  {AUTONOMOUS_DAILY_CAP_OPTIONS.map((cap) => (
                    <option key={cap} value={cap}>
                      {cap} check-in{cap === 1 ? "" : "s"} / day
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <div className="space-y-2.5">
              {CONVERSATION_SCHEDULE_DAYS.map((day) => {
                const blocks = draft.days[day] ?? [];
                const isDayExpanded = expandedDay === day;
                const isToday = day === CURRENT_SCHEDULE_DAY;
                const timelineBlocks = blocks
                  .map((block) => {
                    const range = parseScheduleRange(block.time);
                    return range ? { ...block, ...range } : null;
                  })
                  .filter((block): block is ScheduleBlock & { start: number; end: number } => block !== null)
                  .sort((left, right) => left.start - right.start);

                const formatRulerTick = (hour: number) => {
                  return (hour % 24).toString().padStart(2, "0");
                };

                return (
                  <div key={day} className="overflow-hidden rounded-md border border-[var(--border)]/75 bg-[var(--foreground)]/[0.03] transition-colors hover:bg-[var(--foreground)]/[0.05]">
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isDayExpanded ? null : day)}
                      aria-expanded={isDayExpanded}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,6.75rem)_minmax(0,5.25rem)_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--foreground)]/[0.045] max-md:grid-cols-1 max-md:items-start",
                        isDayExpanded && "bg-[var(--primary)]/[0.05] hover:bg-[var(--primary)]/[0.07]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <ChevronRight
                          size="0.6875rem"
                          className={cn("shrink-0 text-[var(--primary)] transition-transform", isDayExpanded && "rotate-90")}
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-[0.6875rem] font-medium leading-none text-[var(--foreground)]/90">{day}</span>
                            {isToday && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.5rem] font-medium text-[var(--primary)] ring-1 ring-[var(--primary)]/20 md:hidden">
                                <ArrowRight size="0.55rem" />
                                Today
                              </span>
                            )}
                          </div>
                          {isToday && (
                            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.5rem] font-medium text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                              <ArrowRight size="0.55rem" />
                              Today
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex min-w-0 items-start pt-0.5 text-[0.5625rem] text-[var(--muted-foreground)]/76 max-md:pt-0">
                        {!isDayExpanded && (
                          <span className="rounded-full bg-[var(--foreground)]/8 px-2 py-0.5 ring-1 ring-[var(--border)]/45">
                            {blocks.length} block{blocks.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 max-md:w-full">
                        {!isDayExpanded && (blocks.length === 0 ? (
                          <div className="rounded-md border border-dashed border-[var(--border)]/55 bg-[var(--background)]/45 px-3 py-2 text-[0.5625rem] text-[var(--muted-foreground)]/60">
                            No blocks yet
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div
                              className="relative h-4 min-w-0 overflow-hidden rounded-full border border-[var(--border)]/55"
                            >
                              {timelineBlocks.map((block, index) => {
                                const left = (block.start / 1440) * 100;
                                const width = Math.max(3, ((block.end - block.start) / 1440) * 100);

                                return (
                                  <span
                                    key={`${day}-${index}-${block.time}`}
                                    className={cn(
                                      "absolute inset-y-[0.125rem] overflow-hidden rounded-full border border-black/10 shadow-sm",
                                      STATUS_COLORS[block.status],
                                    )}
                                    style={{ left: `${left}%`, width: `calc(${width}% - 0.1rem)` }}
                                    title={`${block.time} — ${block.activity}`}
                                  >
                                    <span className="sr-only">
                                      {block.time} {block.activity}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                            <div className="relative grid grid-cols-[repeat(25,minmax(0,1fr))] gap-0 text-[0.45rem] text-[var(--muted-foreground)]/58">
                              {isToday && (
                                <span
                                  className="pointer-events-none absolute left-0 top-0 w-full"
                                  style={{
                                    transform: `translateX(${Math.max(1.5, Math.min(98.5, (CURRENT_SCHEDULE_MINUTES / 1440) * 100))}%)`,
                                  }}
                                >
                                  <span className="absolute left-0 top-[-0.12rem] -translate-x-1/2">
                                    <span className="block h-0 w-0 border-b-[0.42rem] border-l-[0.28rem] border-r-[0.28rem] border-b-[var(--primary)] border-l-transparent border-r-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]" />
                                  </span>
                                </span>
                              )}
                              {RULER_HOURS.map((hour) => {
                                const showLabel = hour % 3 === 0;

                                return (
                                  <div
                                    key={hour}
                                    className={cn("flex flex-col items-center gap-0.25 pt-0.5", hour === 0 && "items-start", hour === 24 && "items-end")}
                                  >
                                    <span className={cn("w-px bg-[var(--border)]/70", showLabel ? "h-2" : "h-1")} />
                                    {showLabel && <span className="translate-y-[-0.1rem]">{formatRulerTick(hour)}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>

                    {isDayExpanded && (
                      <div className="space-y-3 border-t border-[var(--primary)]/15 bg-[color-mix(in_srgb,var(--primary)_4%,var(--background))] px-3 py-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--primary)_6%,transparent)]">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/72">
              Edit blocks
            </div>
          </div>

                        <div className="space-y-1.5 rounded-md border border-[var(--border)]/55 bg-[var(--background)]/45 px-3 py-2">
                          <p className="text-[0.5rem] uppercase tracking-[0.08em] text-[var(--muted-foreground)]/60">Timeline preview</p>
                          {blocks.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--border)]/65 bg-[var(--background)]/55 px-3 py-3 text-[0.625rem] text-[var(--muted-foreground)]/76">
                              No timeline yet for {day}.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="relative h-4 min-w-0 overflow-hidden rounded-full border border-[var(--border)]/55">
                                {timelineBlocks.map((block, index) => {
                                  const left = (block.start / 1440) * 100;
                                  const width = Math.max(3, ((block.end - block.start) / 1440) * 100);

                                  return (
                                    <span
                                      key={`${day}-${index}-${block.time}`}
                                      className={cn(
                                        "absolute inset-y-[0.125rem] overflow-hidden rounded-full border border-black/10 shadow-sm",
                                        STATUS_COLORS[block.status],
                                      )}
                                      style={{ left: `${left}%`, width: `calc(${width}% - 0.1rem)` }}
                                      title={`${block.time} — ${block.activity}`}
                                    >
                                      <span className="sr-only">
                                        {block.time} {block.activity}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="relative grid grid-cols-[repeat(25,minmax(0,1fr))] gap-0 text-[0.45rem] text-[var(--muted-foreground)]/58">
                                {isToday && (
                                  <span
                                    className="pointer-events-none absolute left-0 top-0 w-full"
                                    style={{
                                      transform: `translateX(${Math.max(1.5, Math.min(98.5, (CURRENT_SCHEDULE_MINUTES / 1440) * 100))}%)`,
                                    }}
                                  >
                                    <span className="absolute left-0 top-[-0.12rem] -translate-x-1/2">
                                      <span className="block h-0 w-0 border-b-[0.42rem] border-l-[0.28rem] border-r-[0.28rem] border-b-[var(--primary)] border-l-transparent border-r-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]" />
                                    </span>
                                  </span>
                                )}
                                {RULER_HOURS.map((hour) => {
                                  const showLabel = hour % 3 === 0;

                                  return (
                                    <div
                                      key={hour}
                                      className={cn("flex flex-col items-center gap-0.25 pt-0.5", hour === 0 && "items-start", hour === 24 && "items-end")}
                                    >
                                      <span className={cn("w-px bg-[var(--border)]/70", showLabel ? "h-2" : "h-1")} />
                                      {showLabel && <span className="translate-y-[-0.1rem]">{formatRulerTick(hour)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          {blocks.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--border)]/75 bg-[var(--background)]/60 px-3 py-3 text-[0.625rem] text-[var(--muted-foreground)]/76">
                              No blocks yet.
                            </div>
                          ) : (
                            <div className="space-y-2">{blocks.map((block, idx) => renderBlockEditor(day, block, idx))}</div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => addBlock(day)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--border)]/80 bg-[var(--foreground)]/[0.03] px-3 py-2 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--foreground)]/[0.06] hover:text-[var(--foreground)]"
                        >
                          Add time block
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-2 border-t border-[var(--border)]/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-[var(--foreground)]/92 px-3 py-2 text-[0.625rem] font-medium text-[var(--background)] transition-colors hover:bg-[var(--foreground)]"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
