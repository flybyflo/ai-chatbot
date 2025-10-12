import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { v } from "convex/values";
import {
  calculateJwkThumbprint,
  exportJWK,
  importPKCS8,
  importSPKI,
  type JWK,
  SignJWT,
} from "jose";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, httpAction, internalAction, query } from "./_generated/server";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const ALG = "RS256";

if (!process.env.SITE_URL) {
  console.warn(
    "SITE_URL environment variable is not set. Falling back to http://localhost:3000 for Better Auth."
  );
}

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) => {
  return betterAuth({
    logger: { disabled: optionsOnly },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },
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
      cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 },
    },
    trustedOrigins: [process.env.SITE_URL || "http://localhost:3000"],
    plugins: [
      convex(), // ← keep your existing plugin
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: (ctx) => authComponent.getAuthUser(ctx),
});

// === MCP token + JWKS additions ==========================================

type PrivateKey = Awaited<ReturnType<typeof importPKCS8>>;

let privateKey: PrivateKey | null = null;
let publicJwk: (JWK & { kid: string; use: string; alg: string }) | null = null;
let kid: string | null = null;

async function ensureKeys(): Promise<void> {
  if (privateKey && publicJwk && kid) {
    return;
  }

  const privPem = process.env.MCP_JWT_PRIVATE_KEY_PEM;
  const pubPem = process.env.MCP_JWT_PUBLIC_KEY_PEM;
  if (!privPem || !pubPem) {
    throw new Error(
      "Missing MCP_JWT_PRIVATE_KEY_PEM or MCP_JWT_PUBLIC_KEY_PEM"
    );
  }

  privateKey = await importPKCS8(privPem, ALG);
  const pubKey = await importSPKI(pubPem, ALG);
  const jwk = await exportJWK(pubKey);
  const jwkKid = await calculateJwkThumbprint(jwk);

  publicJwk = {
    ...jwk,
    kid: jwkKid,
    use: "sig",
    alg: ALG,
  } as JWK & { kid: string; use: string; alg: string };
  kid = jwkKid;
}

async function mintMcpTokenForSubject(subject: string) {
  await ensureKeys();

  const signingKey = privateKey;
  const signingKid = kid;
  if (!signingKey || !signingKid) {
    throw new Error("MCP signing key material is not initialized");
  }

  const iss = siteUrl;
  const aud = process.env.MCP_AUDIENCE ?? "http://127.0.0.1:8080";
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({ scope: "mcp:tools" })
    .setProtectedHeader({ alg: ALG, kid: signingKid })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(signingKey);

  return {
    access_token: jwt,
    token_type: "Bearer" as const,
    expires_in: 3600,
    scope: "mcp:tools" as const,
  };
}

/**
 * Mint an MCP access token for the currently signed-in user.
 * - scope: "mcp:tools"
 * - iss: SITE_URL
 * - aud: MCP_AUDIENCE (your Spring MCP server)
 * - exp: 1h
 */
export const issueMcpToken = action({
  args: {},
  returns: v.object({
    access_token: v.string(),
    token_type: v.literal("Bearer"),
    expires_in: v.number(),
    scope: v.literal("mcp:tools"),
  }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user?._id) {
      throw new Error("Unauthenticated");
    }
    const token = await mintMcpTokenForSubject(String(user._id));
    if (token.scope !== "mcp:tools") {
      throw new Error("Invalid MCP token scope");
    }
    return token;
  },
});

export const issueMcpTokenForUser = internalAction({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    access_token: v.string(),
    token_type: v.literal("Bearer"),
    expires_in: v.number(),
    scope: v.literal("mcp:tools"),
  }),
  handler: async (_ctx, args) => {
    const token = await mintMcpTokenForSubject(args.userId);
    if (token.scope !== "mcp:tools") {
      throw new Error("Invalid MCP token scope");
    }
    return token;
  },
});

/** JWKS for Spring (unauthenticated). */
export const jwks = httpAction(async (_ctx, _req) => {
  await ensureKeys();
  if (!publicJwk) {
    throw new Error("JWKS public key is not initialized");
  }

  return new Response(JSON.stringify({ keys: [publicJwk] }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
});
