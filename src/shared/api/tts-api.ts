import type { TTSConfig, TTSVoicesResponse } from "../../engine/contracts/types/tts";
import { invokeTauri } from "./tauri-client";

export interface TtsSpeakInput {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
}

interface TtsSpeakResponse {
  audioBase64?: string;
  base64?: string;
  audio?: string;
  contentType?: string;
  mimeType?: string;
  ok?: boolean;
  message?: string;
  error?: string;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < binary.length; offset += 8192) {
    const slice = binary.slice(offset, offset + 8192);
    const bytes = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }
    chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  return new Blob(chunks, { type: contentType });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

export const ttsApi = {
  config: () => invokeTauri<TTSConfig>("tts_config"),
  updateConfig: (config: TTSConfig) => invokeTauri<void>("tts_update_config", { config }),
  voices: () => invokeTauri<TTSVoicesResponse>("tts_voices"),
  speak: async (input: TtsSpeakInput, signal?: AbortSignal): Promise<Blob> => {
    throwIfAborted(signal);
    const response = await invokeTauri<TtsSpeakResponse>("tts_speak", { input });
    throwIfAborted(signal);
    const audio = response.audioBase64 ?? response.base64 ?? response.audio;
    if (!audio) {
      throw new Error(response.error ?? response.message ?? "TTS request did not return audio.");
    }
    return base64ToBlob(audio, response.contentType ?? response.mimeType ?? "audio/mpeg");
  },
};
