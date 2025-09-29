"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await auth.api.signInEmail({
      body: {
        email: validatedData.email,
        password: validatedData.password,
      },
      headers: await headers(),
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await auth.api.signUpEmail({
      body: {
        email: validatedData.email,
        password: validatedData.password,
        name: validatedData.email.split("@")[0], // Use email prefix as default name
      },
      headers: await headers(),
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    // Check if it's a user already exists error
    if (error instanceof Error && error.message?.includes("already exists")) {
      return { status: "user_exists" };
    }

    return { status: "failed" };
  }
};
