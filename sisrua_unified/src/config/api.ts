/**
 * API Configuration
 * Automatically detects the correct API URL based on environment
 */

const DEFAULT_API_PATH = '/api';

const normalizePath = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed.startsWith('/')) {
		return DEFAULT_API_PATH;
	}
	return trimmed.replace(/\/+$/, '') || DEFAULT_API_PATH;
};

const normalizeOrigin = (value: string): string | null => {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
};

const parseAllowedOrigins = (raw: string | undefined): Set<string> => {
	if (!raw) {
		return new Set();
	}

	const origins = raw
		.split(/[\s,]+/)
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => normalizeOrigin(entry))
		.filter((entry): entry is string => !!entry);

	return new Set(origins);
};

const resolveApiBaseUrl = (): string => {
	const configured = import.meta.env.VITE_API_URL?.trim();

	// Safe default: same-origin backend route.
	if (!configured) {
		return DEFAULT_API_PATH;
	}

	// Relative paths are always acceptable.
	if (configured.startsWith('/')) {
		return normalizePath(configured);
	}

	const url = (() => {
		try {
			return new URL(configured);
		} catch {
			return null;
		}
	})();

	if (!url) {
		return DEFAULT_API_PATH;
	}

	if (import.meta.env.DEV) {
		return configured.replace(/\/+$/, '');
	}

	// Production hardening: only HTTPS explicit origins are allowed.
	if (url.protocol !== 'https:') {
		console.warn('Ignoring insecure VITE_API_URL in production; falling back to same-origin /api.');
		return DEFAULT_API_PATH;
	}

	const allowedOrigins = parseAllowedOrigins(import.meta.env.VITE_ALLOWED_API_ORIGINS);
	if (allowedOrigins.size > 0 && !allowedOrigins.has(url.origin)) {
		console.warn('Ignoring non-whitelisted VITE_API_URL in production; falling back to same-origin /api.');
		return DEFAULT_API_PATH;
	}

	return configured.replace(/\/+$/, '');
};

const API_BASE_URL = resolveApiBaseUrl();

export { API_BASE_URL };
