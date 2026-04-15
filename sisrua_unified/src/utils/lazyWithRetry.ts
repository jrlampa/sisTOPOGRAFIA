const CHUNK_RELOAD_FLAG = "__sisrua_chunk_reload_once__";

function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const lowered = message.toLowerCase();
  return (
    lowered.includes("failed to fetch dynamically imported module") ||
    lowered.includes("error loading dynamically imported module") ||
    lowered.includes("importing a module script failed") ||
    lowered.includes("loading chunk") ||
    lowered.includes("chunkloaderror")
  );
}

async function clearClientCaches(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export function lazyWithRetry<T>(
  importFactory: () => Promise<{ default: T }>,
): Promise<{ default: T }> {
  return importFactory().catch(async (error) => {
    if (!isChunkLoadError(error)) {
      throw error;
    }

    const canReload = typeof window !== "undefined";
    if (!canReload) {
      throw error;
    }

    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1";
    if (alreadyReloaded) {
      throw error;
    }

    sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
    await clearClientCaches();
    window.location.reload();

    throw error;
  });
}

export function resetChunkReloadFlag(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
}
