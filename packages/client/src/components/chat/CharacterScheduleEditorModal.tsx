import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
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
  onClose: () => void;
  onSave: (characterId: string, updated: WeekSchedule) => void;
}

export function CharacterScheduleEditorModal({
  open,
  characterId,
  characterName,
  schedule,
  onClose,
  onSave,
}: CharacterScheduleEditorModalProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeekSchedule | null>(null);
  const [inactivityThresholdMinutes, setInactivityThresholdMinutes] = useState("120");
  const [idleResponseDelayMinutes, setIdleResponseDelayMinutes] = useState("");
  const [dndResponseDelayMinutes, setDndResponseDelayMinutes] = useState("");
  const [autonomousDailyCapOverride, setAutonomousDailyCapOverride] = useState("");

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
    setExpandedDay(null);
  }, [characterId, open, schedule]);

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

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${characterName} Schedule`} width="max-w-4xl" mobileFullScreen>
      {!draft ? null : (
        <div className="space-y-3">
          <div className="rounded-xl bg-[var(--foreground)]/[0.03] px-3 py-2.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/45">
            Open one character at a time, edit their routine and check-in cap, then save back to chat settings.
          </div>

          <div className="rounded-2xl bg-[var(--secondary)]/20 p-2.5 ring-1 ring-[var(--border)]/70">
            <div className="grid gap-2 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/85">
                  Inactivity
                </span>
                <input
                  type="number"
                  min={15}
                  max={360}
                  step={5}
                  value={inactivityThresholdMinutes}
                  onChange={(e) => setInactivityThresholdMinutes(e.target.value)}
                  className="w-full rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/80 transition-shadow focus:ring-[var(--primary)]/40"
                />
                <span className="block text-[0.5rem] leading-snug text-[var(--muted-foreground)]/70">
                  Minutes before they follow up.
                </span>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/85">
                  Idle Delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={idleResponseDelayMinutes}
                  onChange={(e) => setIdleResponseDelayMinutes(e.target.value)}
                  className="w-full rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/80 transition-shadow focus:ring-[var(--primary)]/40"
                  placeholder="Default"
                />
                <span className="block text-[0.5rem] leading-snug text-[var(--muted-foreground)]/70">
                  Blank keeps the built-in 1-3 minute range.
                </span>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/85">
                  DND Delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={dndResponseDelayMinutes}
                  onChange={(e) => setDndResponseDelayMinutes(e.target.value)}
                  className="w-full rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/80 transition-shadow focus:ring-[var(--primary)]/40"
                  placeholder="Default"
                />
                <span className="block text-[0.5rem] leading-snug text-[var(--muted-foreground)]/70">
                  Blank keeps the built-in 2-5 minute range.
                </span>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/85">
                  Character Check-In Cap
                </span>
                <select
                  value={autonomousDailyCapOverride}
                  onChange={(e) => setAutonomousDailyCapOverride(e.target.value)}
                  className="w-full rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/80 transition-shadow focus:ring-[var(--primary)]/40"
                >
                  <option value="">Default</option>
                  {AUTONOMOUS_DAILY_CAP_OPTIONS.map((cap) => (
                    <option key={cap} value={cap}>
                      {cap} check-in{cap === 1 ? "" : "s"} / day
                    </option>
                  ))}
                </select>
                <span className="block text-[0.5rem] leading-snug text-[var(--muted-foreground)]/70">
                  Blank uses the chat ceiling, then talkativeness.
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            {CONVERSATION_SCHEDULE_DAYS.map((day) => {
              const blocks = draft.days[day] ?? [];
              const isDayExpanded = expandedDay === day;

              return (
                <div key={day} className="rounded-2xl bg-[var(--accent)]/10 ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]/16">
                  <button
                    type="button"
                    onClick={() => setExpandedDay(isDayExpanded ? null : day)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]/12"
                  >
                    <ChevronRight
                      size="0.5625rem"
                      className={cn("text-[var(--muted-foreground)]/75 transition-transform", isDayExpanded && "rotate-90")}
                    />
                    <span className="flex-1 text-[0.625rem] font-medium text-[var(--foreground)]/90">{day}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {blocks.slice(0, 8).map((block, index) => (
                        <span
                          key={index}
                          className={cn("inline-block h-1.5 w-1.5 rounded-full ring-1 ring-[var(--card)]", STATUS_COLORS[block.status])}
                          title={`${block.time} — ${block.activity}`}
                        />
                      ))}
                      {blocks.length > 8 && (
                        <span className="text-[0.5rem] text-[var(--muted-foreground)]/70">+{blocks.length - 8}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-[var(--foreground)]/6 px-1.5 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]/75 ring-1 ring-[var(--border)]/45">
                      {blocks.length}
                    </span>
                  </button>

                  {isDayExpanded && (
                    <div className="mt-1.5 space-y-2 rounded-b-2xl bg-[var(--foreground)]/[0.03] px-2.5 py-2">
                      {blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-lg bg-[var(--background)]/75 p-2 ring-1 ring-[var(--border)]/70">
                          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-[var(--card)]", STATUS_COLORS[block.status])} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              value={block.time}
                              onChange={(e) => updateBlock(day, idx, "time", e.target.value)}
                              className="w-full rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-mono text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/70 transition-shadow focus:ring-[var(--primary)]/40"
                              placeholder="06:00-08:00"
                            />
                            <input
                              value={block.activity}
                              onChange={(e) => updateBlock(day, idx, "activity", e.target.value)}
                              className="w-full rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)]/70 transition-shadow focus:ring-[var(--primary)]/40"
                              placeholder="Activity description"
                            />
                            <div className="flex flex-wrap gap-1">
                              {STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => updateBlock(day, idx, "status", status)}
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[0.5625rem] font-medium transition-colors",
                                    block.status === status
                                      ? "bg-[var(--foreground)]/90 text-[var(--background)]"
                                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                  )}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBlock(day, idx)}
                            className="mt-1 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                            title="Delete block"
                          >
                            <Trash2 size="0.625rem" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBlock(day)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)]/80 bg-[var(--background)]/55 px-2.5 py-1.5 text-[0.5625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/20 hover:text-[var(--foreground)]"
                      >
                        <Plus size="0.5625rem" />
                        Add time block
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)]/60 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-[var(--foreground)]/90 px-3 py-1.5 text-[0.625rem] font-medium text-[var(--background)] transition-colors hover:bg-[var(--foreground)]"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
