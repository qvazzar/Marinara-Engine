import { useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { MoreVertical, PencilLine, Settings2, Trash2 } from "lucide-react";
import type { ConversationPresenceStatus, WeekSchedule as SharedWeekSchedule } from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { cn } from "../../lib/utils";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { CharacterScheduleEditorModal } from "./CharacterScheduleEditorModal";

type OpenSettingsOptions = { initialSection?: "autonomous" | null };

type ConversationPresenceScheduleSectionProps = {
  chatId: string;
  chatMeta: Record<string, any>;
  characterId: string;
  characterName: string;
  schedule?: SharedWeekSchedule;
  onOpenSettings: (event?: ReactMouseEvent<HTMLElement>, options?: OpenSettingsOptions) => void;
};

type UpcomingScheduleBlock = {
  day: string;
  index: number;
  label: string;
  time: string;
  activity: string;
  status: ConversationPresenceStatus;
};

const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function statusDotClass(status?: string) {
  return status === "offline"
    ? "bg-gray-400"
    : status === "dnd"
      ? "bg-red-500"
      : status === "idle"
        ? "bg-yellow-500"
        : "bg-green-500";
}

function statusLabel(status?: string) {
  return status === "offline" ? "Offline" : status === "dnd" ? "Busy" : status === "idle" ? "Away" : "Online";
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function formatScheduleTimeRange(value: string) {
  const [start, end] = value.split("-");
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  const formatPart = (part?: string) => {
    const [hours, minutes] = (part ?? "").split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return part ?? "";
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return formatter.format(date);
  };

  const formattedStart = formatPart(start);
  const formattedEnd = formatPart(end);
  return formattedStart && formattedEnd ? `${formattedStart} - ${formattedEnd}` : value;
}

function getUpcomingScheduleBlocks(schedule?: Partial<SharedWeekSchedule>, limit = 4): UpcomingScheduleBlock[] {
  if (!schedule?.days) return [];

  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming: UpcomingScheduleBlock[] = [];

  for (let dayOffset = 0; dayOffset < SCHEDULE_DAYS.length; dayOffset += 1) {
    const dayIndex = (todayIndex + dayOffset) % SCHEDULE_DAYS.length;
    const dayName = SCHEDULE_DAYS[dayIndex];
    const blocks = [...(schedule.days[dayName] ?? [])]
      .map((block, index) => ({ block, index }))
      .sort((left, right) => {
        const leftStart = parseTimeToMinutes(left.block.time?.split("-")[0]) ?? Number.MAX_SAFE_INTEGER;
        const rightStart = parseTimeToMinutes(right.block.time?.split("-")[0]) ?? Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart;
    });

    for (const { block, index } of blocks) {
      const startMinutes = parseTimeToMinutes(block.time?.split("-")[0]);
      if (startMinutes == null) continue;
      if (dayOffset === 0 && startMinutes <= currentMinutes) continue;

      const dayPrefix = dayOffset === 0 ? "" : dayOffset === 1 ? "Next day" : dayName;
      upcoming.push({
        day: dayName,
        index,
        label: dayPrefix,
        time: block.time ?? "",
        activity: block.activity || statusLabel(block.status),
        status: block.status ?? "online",
      });
      if (upcoming.length >= limit) return upcoming;
    }
  }

  return upcoming;
}

export function ConversationPresenceScheduleSection({
  chatId,
  chatMeta,
  characterId,
  characterName,
  schedule,
  onOpenSettings,
}: ConversationPresenceScheduleSectionProps) {
  const updateMeta = useUpdateChatMetadata();
  const [scheduleModalCharacterId, setScheduleModalCharacterId] = useState<string | null>(null);
  const [scheduleModalInitialDay, setScheduleModalInitialDay] = useState<string | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const hasGeneratedConversationSchedules =
    !!chatMeta.characterSchedules &&
    typeof chatMeta.characterSchedules === "object" &&
    Object.keys(chatMeta.characterSchedules).length > 0;
  const conversationSchedulesEnabled =
    chatMeta.conversationSchedulesEnabled === true ||
    (chatMeta.conversationSchedulesEnabled == null && hasGeneratedConversationSchedules);
  const hasSchedule = !!schedule && Object.keys(schedule.days ?? {}).length > 0;
  const upcomingScheduleBlocks = useMemo(() => getUpcomingScheduleBlocks(schedule), [schedule]);
  const hasUpcomingScheduleBlocks = upcomingScheduleBlocks.length > 0;
  const scheduledDaysCount = schedule ? Object.keys(schedule.days ?? {}).length : 0;

  const scheduleSummary = !conversationSchedulesEnabled
    ? hasGeneratedConversationSchedules
      ? "Autonomous scheduling is off."
      : "Autonomous scheduling is off and no schedule has been generated yet."
    : hasSchedule
      ? hasUpcomingScheduleBlocks
        ? `${scheduledDaysCount} day${scheduledDaysCount === 1 ? "" : "s"} scheduled`
        : "Schedule exists, but nothing is upcoming yet."
      : "Autonomous scheduling is on, but no schedule has been generated yet.";

  const editScheduleLabel = hasSchedule ? "Edit schedule" : "Create schedule";

  const openAutonomousSettings = useCallback(
    (event?: ReactMouseEvent<HTMLElement>) => {
      onOpenSettings(event, { initialSection: "autonomous" });
    },
    [onOpenSettings],
  );

  const toggleConversationSchedules = useCallback(() => {
    updateMeta.mutate({
      id: chatId,
      conversationSchedulesEnabled: !conversationSchedulesEnabled,
    });
  }, [chatId, conversationSchedulesEnabled, updateMeta]);

  const openFullScheduleEditor = useCallback(() => setScheduleModalCharacterId(characterId), [characterId]);

  const openDayInEditor = useCallback(
    (day: string) => {
      setScheduleModalInitialDay(day);
      setScheduleModalCharacterId(characterId);
    },
    [characterId],
  );

  const saveCharacterSchedule = useCallback(
    (savedCharacterId: string, updated: SharedWeekSchedule) => {
      updateMeta.mutate({
        id: chatId,
        characterSchedules: {
          ...(chatMeta.characterSchedules ?? {}),
          [savedCharacterId]: updated,
        },
      });
    },
    [chatId, chatMeta.characterSchedules, updateMeta],
  );

  const removeScheduleBlock = useCallback(
    (day: string, blockIndex: number) => {
      if (!schedule) return;
      const nextSchedule: SharedWeekSchedule = {
        ...schedule,
        days: {
          ...(schedule.days ?? {}),
          [day]: (schedule.days?.[day] ?? []).filter((_, index) => index !== blockIndex),
        },
      };
      saveCharacterSchedule(characterId, nextSchedule);
    },
    [characterId, saveCharacterSchedule, schedule],
  );

  const menuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label: "Edit full schedule",
        icon: <Settings2 size="0.75rem" />,
        onSelect: openFullScheduleEditor,
      },
      {
        label: conversationSchedulesEnabled ? "Disable autonomous schedules" : "Enable autonomous schedules",
        onSelect: toggleConversationSchedules,
      },
      {
        label: "Open autonomous settings",
        onSelect: () => openAutonomousSettings(),
      },
    ],
    [conversationSchedulesEnabled, openAutonomousSettings, openFullScheduleEditor, toggleConversationSchedules],
  );

  return (
    <div className="mt-1.5 rounded-md border border-[var(--border)]/75 bg-[var(--foreground)]/[0.025] px-2.5 py-2 transition-colors hover:bg-[var(--foreground)]/[0.035]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/72">
              Schedule
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.5625rem] ring-1",
                conversationSchedulesEnabled
                  ? "bg-[var(--accent)]/12 text-[var(--foreground)] ring-[var(--border)]/60"
                  : "bg-[var(--foreground)]/6 text-[var(--muted-foreground)]/82 ring-[var(--border)]/45",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", conversationSchedulesEnabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/65")} />
              {conversationSchedulesEnabled ? (hasSchedule ? "Active" : "Ready") : "Off"}
            </span>
            <span className="text-[0.5625rem] text-[var(--muted-foreground)]/56">•</span>
            <span className="truncate text-[0.5625rem] text-[var(--muted-foreground)]/72">{scheduleSummary}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-md bg-[var(--foreground)]/8 px-2 text-[0.625rem] leading-4 text-[var(--foreground)]/82 ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/12 hover:text-[var(--foreground)]"
            onClick={() => setScheduleModalCharacterId(characterId)}
          >
            <PencilLine size="0.75rem" className="shrink-0" />
            <span>{editScheduleLabel}</span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-[2rem] items-center rounded-md px-1.5 text-[var(--muted-foreground)]/72 transition-colors hover:bg-[var(--foreground)]/6 hover:text-[var(--muted-foreground)]/92"
            title="More"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMoreMenuPosition({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
            <MoreVertical size="0.75rem" />
          </button>
        </div>
      </div>

      <div className="mt-2 border-t border-[var(--border)]/50 pt-2">
        {!hasSchedule ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--foreground)]/[0.03] px-2 py-1.5 ring-1 ring-[var(--border)]/50">
            <p className="min-w-0 text-[0.625rem] leading-4 text-[var(--muted-foreground)]/82">
              {conversationSchedulesEnabled
                ? `${characterName} is ready for a schedule, but nothing has been generated yet.`
                : `${characterName} is paused from autonomous scheduling.`}
            </p>
            <button
              type="button"
              className="shrink-0 rounded-md bg-[var(--foreground)]/8 px-2 py-1 text-[0.625rem] text-[var(--foreground)]/82 ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/12 hover:text-[var(--foreground)]"
              onClick={openAutonomousSettings}
            >
              Open settings
            </button>
          </div>
        ) : hasUpcomingScheduleBlocks ? (
          <div className="space-y-2">
            {upcomingScheduleBlocks.map((block, index) => {
              const previousBlock = index > 0 ? upcomingScheduleBlocks[index - 1] : null;
              const showLabel = !!block.label && block.label !== previousBlock?.label;

              return (
                <div
                  key={`${block.day}-${block.index}`}
                  role="button"
                  tabIndex={0}
                  className="group min-w-0 rounded-md bg-[var(--foreground)]/[0.03] px-2 py-1.5 text-left ring-1 ring-[var(--border)]/45 transition-colors hover:bg-[var(--foreground)]/[0.05]"
                  onClick={() => openDayInEditor(block.day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDayInEditor(block.day);
                    }
                  }}
                >
                  {showLabel ? (
                    <div className="mb-1 text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/52">
                      {block.label}
                    </div>
                  ) : null}
                  <div className="grid min-w-0 grid-cols-[auto_6.75rem_minmax(0,1fr)_auto] items-start gap-x-2">
                    <span className={cn("mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(block.status))} />
                    <span className="justify-self-start rounded-full bg-[var(--foreground)]/6 px-1.5 py-0.5 text-center text-[0.5625rem] tabular-nums text-[var(--muted-foreground)]/78 ring-1 ring-[var(--border)]/45">
                      {formatScheduleTimeRange(block.time)}
                    </span>
                    <div className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-[0.05rem] text-[0.625rem] leading-4 text-[var(--muted-foreground)]/82 group-hover:text-[var(--foreground)]/88">
                      {block.activity}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded-md p-1 text-[var(--muted-foreground)]/76 transition-colors hover:bg-[var(--foreground)]/8 hover:text-[var(--foreground)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDayInEditor(block.day);
                        }}
                        aria-label={`Edit ${block.time}`}
                      >
                        <PencilLine size="0.7rem" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-[var(--muted-foreground)]/76 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeScheduleBlock(block.day, block.index);
                        }}
                        aria-label={`Remove ${block.time}`}
                      >
                        <Trash2 size="0.7rem" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasSchedule ? (
          <div className="rounded-md bg-[var(--foreground)]/[0.03] px-2 py-1.5 ring-1 ring-[var(--border)]/50">
            <p className="text-[0.625rem] leading-4 text-[var(--muted-foreground)]/82">No upcoming blocks right now.</p>
          </div>
        ) : null}
      </div>

      {moreMenuPosition && (
        <ContextMenu x={moreMenuPosition.x} y={moreMenuPosition.y} items={menuItems} onClose={() => setMoreMenuPosition(null)} />
      )}

      <CharacterScheduleEditorModal
        open={!!scheduleModalCharacterId}
        characterId={scheduleModalCharacterId}
        characterName={characterName}
        schedule={schedule}
        initialDay={scheduleModalInitialDay}
        onClose={() => setScheduleModalCharacterId(null)}
        onSave={saveCharacterSchedule}
      />
    </div>
  );
}
