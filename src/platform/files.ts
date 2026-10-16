export type SaveFileResult =
  | { status: 'saved'; path?: string }
  | { status: 'cancelled' };

export interface SaveFileOptions {
  suggestedName: string;
  mime: string;
  data: Uint8Array | string;
}

export async function saveFile({
  suggestedName,
  mime,
  data,
}: SaveFileOptions): Promise<SaveFileResult> {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  if (__DESKTOP__) {
    const { invoke } = await import('@tauri-apps/api/core');
    const savedPath = await invoke<string | null>('export_file', bytes, {
      headers: {
        'x-file-name': encodeURIComponent(suggestedName),
      },
    });
    if (!savedPath) {
      return { status: 'cancelled' };
    }
    return { status: 'saved', path: savedPath };
  }

  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { status: 'saved' };
}
