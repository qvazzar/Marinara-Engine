// ──────────────────────────────────────────────
// Function Calling / Tool Use Types
// ──────────────────────────────────────────────

/** JSON Schema subset for tool parameter definitions. */
export interface ToolParameterSchema {
  type: "object" | "string" | "number" | "boolean" | "array";
  description?: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  items?: ToolParameterProperty;
}

export interface ToolParameterProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
  default?: unknown;
}

/** Definition of a tool/function that an agent can call. */
export interface ToolDefinition {
  /** Unique tool name (e.g. "get_weather", "roll_dice") */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the parameters */
  parameters: ToolParameterSchema;
}

/** A tool call made by the model during generation. */
export interface ToolCall {
  /** Server-assigned ID for tracking */
  id: string;
  /** Which tool to call */
  name: string;
  /** Parsed arguments */
  arguments: Record<string, unknown>;
}

/** Result of executing a tool call. */
export interface ToolResult {
  /** Matches the ToolCall id */
  toolCallId: string;
  /** Tool name for display */
  name: string;
  /** Stringified result */
  result: string;
  /** Whether execution succeeded */
  success: boolean;
}

/** A user-created custom function tool persisted in DB. */
export interface CustomTool {
  id: string;
  name: string;
  description: string;
  parametersSchema: ToolParameterSchema;
  executionType: "webhook" | "static" | "script";
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Extended AgentConfig with tool definitions. */
export interface AgentToolConfig {
  /** Tools this agent can use */
  tools: ToolDefinition[];
  /** How many tool calls are allowed per turn (0 = unlimited) */
  maxCallsPerTurn: number;
  /** Whether to allow parallel tool calls */
  parallelCalls: boolean;
}

/** Built-in tool definitions available to all agents. */
export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: "roll_dice",
    description:
      "Roll dice using standard notation (e.g. 2d6, 1d20+5). Used for RPG mechanics, skill checks, and random outcomes.",
    parameters: {
      type: "object",
      properties: {
        notation: { type: "string", description: "Dice notation (e.g. '2d6', '1d20+5', '3d8-2')" },
        reason: { type: "string", description: "Why the roll is being made (e.g. 'Perception check')" },
      },
      required: ["notation"],
    },
  },
  {
    name: "update_game_state",
    description: "Update the current game state — character stats, inventory, quest progress, etc.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of update",
          enum: ["stat_change", "inventory_add", "inventory_remove", "quest_update", "location_change", "time_advance"],
        },
        target: { type: "string", description: "Who or what is being updated (character name or 'player')" },
        key: { type: "string", description: "The specific stat/item/quest being changed" },
        value: { type: "string", description: "The new value or change amount" },
        description: { type: "string", description: "Human-readable description of the change" },
      },
      required: ["type", "target", "key", "value"],
    },
  },
  {
    name: "set_expression",
    description: "Set a character's sprite expression for visual novel display.",
    parameters: {
      type: "object",
      properties: {
        characterName: { type: "string", description: "Name of the character" },
        expression: { type: "string", description: "Expression name (e.g. happy, sad, angry, neutral)" },
      },
      required: ["characterName", "expression"],
    },
  },
  {
    name: "trigger_event",
    description: "Trigger a narrative event — introduce an NPC, start a quest, change the scene, etc.",
    parameters: {
      type: "object",
      properties: {
        eventType: {
          type: "string",
          description: "Type of event",
          enum: [
            "npc_entrance",
            "npc_exit",
            "quest_start",
            "quest_complete",
            "scene_change",
            "combat_start",
            "combat_end",
            "revelation",
            "custom",
          ],
        },
        description: { type: "string", description: "What happens in this event" },
        involvedCharacters: { type: "array", items: { type: "string" }, description: "Names of characters involved" },
      },
      required: ["eventType", "description"],
    },
  },
  {
    name: "search_lorebook",
    description: "Search the lorebook for relevant world-building information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query — keywords, character names, locations, etc." },
        category: { type: "string", description: "Optional category filter" },
      },
      required: ["query"],
    },
  },
  {
    name: "save_lorebook_entry",
    description:
      "Create or update an entry in the lorebook selected for this agent. Use it only for durable facts, world lore, characters, locations, or long-term story developments worth remembering.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short entry title, such as a character, location, object, or event name" },
        content: { type: "string", description: "Concise lorebook entry content to store" },
        description: { type: "string", description: "Optional one-line description for routing and editor context" },
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Optional trigger/search keys. If omitted, the title is used as a key.",
        },
        tag: { type: "string", description: "Optional category tag" },
        mode: {
          type: "string",
          enum: ["create", "replace", "append"],
          description:
            "How to handle an existing entry with the same name in the selected lorebook. Defaults to replace.",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "read_chat_summary",
    description: "Read the current persisted chat summary for this chat.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "append_chat_summary",
    description: "Append durable memory text to the persisted chat summary for this chat.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Concise summary text to append. Include only durable facts, plans, preferences, or story developments.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "read_chat_variable",
    description:
      "Read a chat-wide string variable by key. Use this for agent-private state or coordination with other agents in the same chat.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Variable key to read" },
      },
      required: ["key"],
    },
  },
  {
    name: "write_chat_variable",
    description:
      "Write or replace a chat-wide string variable by key. Any agent in this chat can read the value if it knows the key.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Variable key to write" },
        value: { type: "string", description: "String value to store for this key" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "spotify_get_current_playback",
    description:
      "Get the user's current Spotify playback state, track, active device, and volume. Use this before changing music so you do not restart or replace a fitting track.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "spotify_get_playlists",
    description:
      "Get the user's Spotify playlists and saved library. Returns playlist names and URIs. Use this FIRST to see what the user already has before searching.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of playlists to return (default: 20, max: 50)" },
      },
    },
  },
  {
    name: "spotify_get_playlist_tracks",
    description:
      "Get track candidates from a specific playlist or the user's Liked Songs. By default, the server indexes/caches the full source and returns only a compact scored shortlist for the model. Supplying offset switches to raw page mode.",
    parameters: {
      type: "object",
      properties: {
        playlistId: {
          type: "string",
          description: "Playlist ID (from spotify_get_playlists), or 'liked' for the user's Liked Songs library",
        },
        query: {
          type: "string",
          description:
            "Scene/mood search terms used to score candidates from the full cached playlist, e.g. 'tense battle orchestral' or 'quiet melancholy'.",
        },
        mood: {
          type: "string",
          description: "Optional short mood label to combine with query when choosing candidates.",
        },
        candidateLimit: {
          type: "number",
          description: "How many candidate tracks to return in candidate mode (default: 60, max: 80).",
        },
        limit: {
          type: "number",
          description: "Candidate count in default mode, or page size when offset is provided (page max: 50).",
        },
        offset: {
          type: "number",
          description:
            "Optional raw-page offset. Only use for manual browsing; default mode is cached candidate selection.",
        },
      },
      required: ["playlistId"],
    },
  },
  {
    name: "spotify_search",
    description:
      "Search Spotify for tracks matching a mood, genre, or specific query. Returns a list of track URIs. Prefer using the user's playlists/liked songs first.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query — mood keywords, genre, artist, or track name (e.g. 'dark ambient orchestral', 'battle music epic')",
        },
        limit: { type: "number", description: "Number of results to return (default: 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "spotify_play",
    description:
      "Play one or more tracks, or a playlist, on the user's active Spotify device. In game mode, pass one best track URI so it can loop until a new scene pick.",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description:
            "Single Spotify URI to play (e.g. 'spotify:track:xxx' or 'spotify:playlist:xxx'). Use 'uris' instead when queueing multiple tracks.",
        },
        uris: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of Spotify track URIs to play as a queue (e.g. ['spotify:track:xxx', 'spotify:track:yyy']). The first track plays immediately, the rest are queued.",
        },
        reason: { type: "string", description: "Why this track fits the current scene mood" },
      },
      required: [],
    },
  },
  {
    name: "spotify_set_volume",
    description: "Set the playback volume on the user's active Spotify device (0-100).",
    parameters: {
      type: "object",
      properties: {
        volume: { type: "number", description: "Volume level (0-100)" },
        reason: {
          type: "string",
          description: "Why the volume is being adjusted (e.g. 'quiet scene', 'intense battle')",
        },
      },
      required: ["volume"],
    },
  },
];
