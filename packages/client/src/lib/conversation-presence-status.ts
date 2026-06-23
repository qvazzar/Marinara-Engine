import {
  getActiveStatusOverride,
  getEffectiveCurrentStatus,
  type ConversationPresenceStatus,
  type ConversationStatusOverride,
  type WeekSchedule,
} from "@marinara-engine/shared";

type ConversationPresenceMeta = {
  conversationSchedulesEnabled?: unknown;
  characterSchedules?: unknown;
  conversationStatusOverrides?: unknown;
};

/**
 * Resolve a character's live conversation presence the same way the server's
 * status endpoint does — active manual override first, then the current schedule
 * block — so the chat-list sidebar and the in-chat overlay agree with the
 * presence pill instead of reading a generation-time snapshot.
 *
 * Returns `null` when there is no live signal (no active override and the chat
 * has not opted into schedules), in which case the caller keeps the stored
 * `conversationCharacterStatuses` snapshot. This is the single gate both client
 * surfaces share, so they cannot drift on which metadata is allowed to drive
 * live status.
 *
 * Schedules require an explicit `conversationSchedulesEnabled === true` opt-in
 * (which the server sets whenever it generates schedules), so a stray or
 * imported schedule-shaped payload cannot outvote the snapshot. Overrides are
 * validated by `getActiveStatusOverride` (status enum + expiry), so a malformed
 * or expired override also falls through to the snapshot.
 */
export function resolveLiveConversationStatus(
  meta: ConversationPresenceMeta | null | undefined,
  characterId: string,
  now: Date,
): { status: ConversationPresenceStatus; activity: string } | null {
  if (!meta) return null;
  const override = (meta.conversationStatusOverrides as Record<string, ConversationStatusOverride> | undefined)?.[
    characterId
  ];
  const schedule =
    meta.conversationSchedulesEnabled === true
      ? (meta.characterSchedules as Record<string, WeekSchedule> | undefined)?.[characterId]
      : undefined;
  if (!getActiveStatusOverride(override, now) && !schedule) return null;
  const { status, activity } = getEffectiveCurrentStatus(schedule, override, now);
  return { status, activity };
}
