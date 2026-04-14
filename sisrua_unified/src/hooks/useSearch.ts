import { useState, useEffect, useRef } from "react";
import { GeoLocation } from "../types";
import { API_BASE_URL } from "../config/api";
import { getSearchQueryFeedback, shouldAutoSearch } from "../utils/validation";

interface UseSearchProps {
  onLocationFound: (location: GeoLocation) => void;
  onError: (message: string) => void;
  debounceMs?: number;
}

export function useSearch({
  onLocationFound,
  onError,
  debounceMs = 600,
}: UseSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const executeSearch = async (query: string) => {
    const sanitizedQuery = query.trim();
    const validation = getSearchQueryFeedback(sanitizedQuery);

    if (!validation.isValid) {
      onError(validation.message);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sanitizedQuery }),
      });

      if (!response.ok) {
        let apiErrorMessage = "Location not found";

        try {
          const errorPayload = (await response.json()) as {
            details?: string;
            error?: string;
            message?: string;
          };

          apiErrorMessage =
            errorPayload.details ||
            errorPayload.error ||
            errorPayload.message ||
            apiErrorMessage;
        } catch {
          // Keep fallback message when response body is not JSON.
        }

        throw new Error(apiErrorMessage);
      }

      const location: GeoLocation = await response.json();

      if (location) {
        onLocationFound(location);
      } else {
        throw new Error("No location data received");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed";
      onError(message);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce logic
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (shouldAutoSearch(searchQuery)) {
      timeoutRef.current = setTimeout(() => {
        executeSearch(searchQuery);
      }, debounceMs);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [searchQuery, debounceMs]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await executeSearch(searchQuery);
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    executeSearch,
  };
}
