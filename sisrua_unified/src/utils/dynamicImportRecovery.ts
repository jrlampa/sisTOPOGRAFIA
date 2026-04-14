import React from 'react';
import Logger from './logger';

type LazyModule<T extends React.ComponentType<any>> = {
  default: T;
};

const CHUNK_ERROR_PATTERNS = [
  'dynamically imported module',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
];

const getRecoveryKey = (source: string) => `sisrua-chunk-recovery:${source}`;

export const isDynamicImportError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message?.toLowerCase?.() ?? ''
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';

  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const recoverFromDynamicImportError = async (): Promise<void> => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (recoveryError) {
    Logger.warn('Chunk recovery cleanup failed', recoveryError);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
};

export const attemptDynamicImportRecovery = async (
  error: unknown,
  source: string,
): Promise<boolean> => {
  if (!isDynamicImportError(error)) {
    return false;
  }

  const recoveryKey = getRecoveryKey(source);
  const alreadyAttempted = sessionStorage.getItem(recoveryKey) === '1';
  if (alreadyAttempted) {
    return false;
  }

  sessionStorage.setItem(recoveryKey, '1');
  await recoverFromDynamicImportError();
  return true;
};

export const lazyWithRecovery = <T extends React.ComponentType<any>>(
  importer: () => Promise<LazyModule<T>>,
  source: string,
): React.LazyExoticComponent<T> =>
  React.lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const recovered = await attemptDynamicImportRecovery(error, source);
      if (recovered) {
        return new Promise<never>(() => {});
      }

      throw error;
    }
  });