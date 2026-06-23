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
    };
    onSave(characterId, nextDraft);
    onClose();
  }, [characterId, dndResponseDelayMinutes, draft, idleResponseDelayMinutes, inactivityThresholdMinutes, onClose, onSave, parseOptionalMinutes, parseRequiredMinutes]);

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${characterName} Schedule`} width="max-w-4xl">
      {!draft ? null : (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            Open one character at a time, edit their routine, then save back to chat settings.
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 px-3 py-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Inactivity
                </span>
                <input
                  type="number"
                  min={15}
                  max={360}
                  step={5}
                  value={inactivityThresholdMinutes}
                  onChange={(e) => setInactivityThresholdMinutes(e.target.value)}
                  className="w-full rounded bg-[var(--background)] px-2 py-1.5 text-[0.6875rem] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/40"
                />
                <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                  Minutes before they follow up.
                </span>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Idle Delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={idleResponseDelayMinutes}
                  onChange={(e) => setIdleResponseDelayMinutes(e.target.value)}
                  className="w-full rounded bg-[var(--background)] px-2 py-1.5 text-[0.6875rem] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/40"
                  placeholder="Default"
                />
                <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                  Blank keeps the built-in 1-3 minute range.
                </span>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.55rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  DND Delay
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={0.5}
                  value={dndResponseDelayMinutes}
                  onChange={(e) => setDndResponseDelayMinutes(e.target.value)}
                  className="w-full rounded bg-[var(--background)] px-2 py-1.5 text-[0.6875rem] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/40"
                  placeholder="Default"
                />
                <span className="block text-[0.5rem] text-[var(--muted-foreground)]">
                  Blank keeps the built-in 2-5 minute range.
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            {CONVERSATION_SCHEDULE_DAYS.map((day) => {
              const blocks = draft.days[day] ?? [];
              const isDayExpanded = expandedDay === day;

              return (
                <div key={day} className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20">
                  <button
                    type="button"
                    onClick={() => setExpandedDay(isDayExpanded ? null : day)}
                    className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/40"
                  >
                    <ChevronRight
                      size="0.5625rem"
                      className={cn("text-[var(--muted-foreground)] transition-transform", isDayExpanded && "rotate-90")}
                    />
                    <span className="flex-1 text-[0.625rem] font-medium">{day}</span>
                    <span className="flex gap-0.5">
                      {blocks.slice(0, 8).map((block, index) => (
                        <span
                          key={index}
                          className={cn("inline-block h-1.5 w-1.5 rounded-full", STATUS_COLORS[block.status])}
                          title={`${block.time} — ${block.activity}`}
                        />
                      ))}
                      {blocks.length > 8 && (
                        <span className="text-[0.5rem] text-[var(--muted-foreground)]">+{blocks.length - 8}</span>
                      )}
                    </span>
                    <span className="text-[0.5rem] text-[var(--muted-foreground)]">{blocks.length}</span>
                  </button>

                  {isDayExpanded && (
                    <div className="space-y-1.5 border-t border-[var(--border)] px-3 py-2">
                      {blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 rounded-md bg-[var(--background)] p-1.5">
                          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_COLORS[block.status])} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              value={block.time}
                              onChange={(e) => updateBlock(day, idx, "time", e.target.value)}
                              className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] font-mono outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                              placeholder="06:00-08:00"
                            />
                            <input
                              value={block.activity}
                              onChange={(e) => updateBlock(day, idx, "activity", e.target.value)}
                              className="w-full rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                              placeholder="Activity description"
                            />
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => updateBlock(day, idx, "status", status)}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors",
                                    block.status === status
                                      ? "bg-[var(--primary)] text-white"
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
                            className="mt-1 rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                            title="Delete block"
                          >
                            <Trash2 size="0.625rem" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBlock(day)}
                        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-[0.5625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/40 hover:text-[var(--foreground)]"
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

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-white transition-colors hover:bg-[var(--primary)]/80"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
