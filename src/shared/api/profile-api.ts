import { invokeTauri } from "./tauri-client";
import { ApiError } from "./api-errors";
import { downloadPayloadFromApiValue, type DownloadPayload } from "./download-payload";
import { remoteRuntimeTarget } from "./remote-runtime";

export async function exportProfile(): Promise<DownloadPayload> {
  const value = await invokeTauri("profile_export");
  return downloadPayloadFromApiValue(value, "marinara-profile.json", "application/json");
}

export async function importProfile<T>(envelope: unknown): Promise<T> {
  return invokeTauri<T>("profile_import", { envelope });
}

export async function importProfileFile<T>(path: string): Promise<T> {
  if (remoteRuntimeTarget()) {
    throw new ApiError(
      "Profile import from a local file path is not available while Remote Runtime is configured.",
      400,
      { code: "remote_local_path_unsupported" },
    );
  }
  return invokeTauri<T>("profile_import_file", { path });
}

export const profileApi = {
  exportProfile,
  importProfile,
  importProfileFile,
};
