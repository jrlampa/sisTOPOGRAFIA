import { useState, useCallback, useRef } from 'react';
import { GeoLocation } from '../types';
import { API_BASE_URL } from '../config/api';
import { debounce } from '../utils/debounce';

const DEBOUNCE_DELAY_MS = 400;

interface UseSearchProps {
  onLocationFound: (location: GeoLocation) => void;
  onError: (message: string) => void;
}

export function useSearch({ onLocationFound, onError }: UseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const executeSearch = useCallback(async (query: string) => {
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) {
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sanitizedQuery })
      });

      if (!response.ok) {
        let apiErrorMessage = 'Location not found';

        try {
          const errorPayload = await response.json() as {
            details?: string;
            error?: string;
            message?: string;
          };

          apiErrorMessage = errorPayload.details || errorPayload.error || errorPayload.message || apiErrorMessage;
        } catch {
          // Keep fallback message when response body is not JSON.
        }

        throw new Error(apiErrorMessage);
      }

      const location: GeoLocation = await response.json();

      if (location) {
        onLocationFound(location);
      } else {
        throw new Error('No location data received');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      onError(message);
    } finally {
      setIsSearching(false);
    }
  }, [onLocationFound, onError]);

  // Debounced version for input-as-type scenarios (e.g. autocomplete).
  // Stable ref ensures the debounced function is not recreated on every render.
  const debouncedSearchRef = useRef(debounce(executeSearch, DEBOUNCE_DELAY_MS));

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearch(searchQuery);
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    executeSearch,
    debouncedSearch: debouncedSearchRef.current,
  };
}
