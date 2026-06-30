export interface DownloadEvent {
  event: string;
  data: {
    contentLength?: number | null;
    chunkLength: number;
  };
}

export interface Update {
  version: string;
  downloadAndInstall(onEvent: (event: DownloadEvent) => void): Promise<void>;
}

export async function check(): Promise<Update | null> {
  return null;
}
