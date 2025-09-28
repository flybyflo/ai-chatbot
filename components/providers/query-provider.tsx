"use client";

import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Always show cache instantly, then refresh in the background
            refetchOnMount: "always",
            // Data is considered fresh for 30 seconds but we still refetch on mount
            staleTime: 30 * 1000,
            // Keep cache around long enough to enable instant back/forward navigation
            gcTime: 10 * 60 * 1000,
            // Retry failed requests 2 times
            retry: 2,
            // Avoid flicker on focus; we already refetch on mount
            refetchOnWindowFocus: false,
            // Use previous cached data as placeholder to render instantly
            placeholderData: keepPreviousData,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
