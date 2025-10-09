"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const convex = convexUrl
  ? new ConvexReactClient(convexUrl, {
      // Optionally pause queries until the user is authenticated
      expectAuth: true,
    })
  : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    console.warn(
      "NEXT_PUBLIC_CONVEX_URL environment variable is not set. Convex client will not be initialized."
    );
    return <>{children}</>;
  }

  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convex}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
