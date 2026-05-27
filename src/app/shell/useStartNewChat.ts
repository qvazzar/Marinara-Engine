import { useCallback } from "react";
import type { ChatMode } from "../../engine/contracts/types/chat";
import { useApplyChatPreset, useChatPresets } from "../../features/catalog/chat-presets/index";
import { useCreateChat } from "../../features/catalog/chats/index";
import { useConnections } from "../../features/catalog/connections/index";
import { filterLanguageGenerationConnections } from "../../shared/lib/connection-filters";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";

const CHAT_MODE_LABELS: Partial<Record<ChatMode, string>> = {
  conversation: "Conversation",
  roleplay: "Roleplay",
  game: "Game",
};

export function useStartNewChat() {
  const { data: connections } = useConnections();
  const { data: chatPresetsData } = useChatPresets();
  const createChat = useCreateChat();
  const applyChatPreset = useApplyChatPreset();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  return useCallback(
    (mode: ChatMode) => {
      const connectionRows = filterLanguageGenerationConnections(
        (connections ?? []) as Array<{ id: string; provider?: string }>,
      ).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        if (mode === "conversation" || mode === "roleplay" || mode === "game") {
          setPendingNewChatMode(mode);
        }
        return;
      }

      if (hasAnyDetailOpen()) {
        closeAllDetails();
      }

      const presets = chatPresetsData ?? [];
      const presetMode: ChatMode | null = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? (presets.find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault) ?? null)
        : null;

      createChat.mutate(
        {
          name: `New ${CHAT_MODE_LABELS[mode] ?? mode}`,
          mode,
          characterIds: [],
          connectionId: connectionRows[0]!.id,
        },
        {
          onSuccess: async (chat) => {
            setActiveChatId(chat.id);
            if (starred) {
              try {
                await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
              } catch {
                /* non-fatal: chat still opens with system defaults */
              }
            }
            useChatStore.getState().setShouldOpenSettings(true, chat.id);
            useChatStore.getState().setShouldOpenWizard(true, chat.id);
          },
        },
      );
    },
    [
      applyChatPreset,
      chatPresetsData,
      closeAllDetails,
      connections,
      createChat,
      hasAnyDetailOpen,
      setActiveChatId,
      setPendingNewChatMode,
    ],
  );
}
