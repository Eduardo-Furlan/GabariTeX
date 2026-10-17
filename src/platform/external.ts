export async function openExternal(url: string): Promise<void> {
  if (__DESKTOP__) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (err) {
      console.error('Falha ao abrir link externo via Tauri', err);
      // sem fallback silencioso para window.open: em webview ele também não abre
      throw err;
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

