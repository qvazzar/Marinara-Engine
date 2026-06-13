import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const spotifyAgentManifest = {
  id: "spotify",
  name: "Spotify DJ",
  description:
    "Analyzes the narrative mood and controls Spotify playback — searching tracks, adjusting volume, and cueing music to match the scene. Requires a Spotify Premium account and API credentials.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [
    "spotify_get_current_playback",
    "spotify_get_playlists",
    "spotify_get_playlist_tracks",
    "spotify_search",
    "spotify_play",
    "spotify_set_volume",
  ],
} satisfies BuiltInAgentManifest;
