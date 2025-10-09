import { getStaticAuth } from "@convex-dev/better-auth";
import { createAuth } from "@/convex/auth";
import type { UserType } from "./enums";

export const auth = getStaticAuth(createAuth);

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

export type { UserType };
