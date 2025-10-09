import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

const siteUrl = process.env.SITE_URL;

if (!siteUrl) {
  throw new Error("SITE_URL environment variable must be set for Better Auth.");
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) => {
  return betterAuth({
    // disable logging when createAuth is called just to generate options.
    // this is not required, but there's a lot of noise in logs without it.
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Configure email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },
    // Social providers (optional - keeping your existing config)
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || "placeholder",
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "placeholder",
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID || "placeholder",
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "placeholder",
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
    trustedOrigins: [process.env.SITE_URL || "http://localhost:3000"],
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex(),
    ],
  });
};

// Example function for getting the current user
export const getCurrentUser = query({
  args: {},
  handler: (ctx) => authComponent.getAuthUser(ctx),
});
