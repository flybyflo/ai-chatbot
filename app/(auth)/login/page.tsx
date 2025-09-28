"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                placeholder="m@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  className="ml-auto inline-block text-sm underline"
                  href="#"
                >
                  Forgot your password?
                </Link>
              </div>

              <Input
                autoComplete="password"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                type="password"
                value={password}
              />
            </div>

            <Button
              className="w-full"
              disabled={loading}
              onClick={async () => {
                await signIn.email(
                  {
                    email,
                    password,
                  },
                  {
                    onRequest: (_ctx) => {
                      setLoading(true);
                    },
                    onResponse: (_ctx) => {
                      setLoading(false);
                    },
                    onSuccess: () => {
                      toast.success("Successfully signed in!");
                      router.push("/");
                    },
                    onError: (ctx) => {
                      toast.error(
                        ctx.error.message ||
                          "Failed to sign in. Please check your credentials."
                      );
                    },
                  }
                );
              }}
              type="submit"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <p> Login </p>
              )}
            </Button>

            <div
              className={cn(
                "flex w-full items-center gap-2",
                "flex-col justify-between"
              )}
            >
              <Button
                className={cn("w-full gap-2")}
                disabled={loading}
                onClick={async () => {
                  await signIn.social(
                    {
                      provider: "microsoft",
                      callbackURL: "/",
                    },
                    {
                      onRequest: (_ctx) => {
                        setLoading(true);
                      },
                      onResponse: (_ctx) => {
                        setLoading(false);
                      },
                      onError: (_ctx) => {
                        toast.error("Microsoft sign-in is not configured yet.");
                      },
                    }
                  );
                }}
                variant="outline"
              >
                <svg
                  height="1em"
                  viewBox="0 0 24 24"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 3h9v9H2zm9 19H2v-9h9zM21 3v9h-9V3zm0 19h-9v-9h9z"
                    fill="currentColor"
                  />
                </svg>
                Sign in with Microsoft
              </Button>
              <Button
                className={cn("w-full gap-2")}
                disabled={loading}
                onClick={async () => {
                  await signIn.social(
                    {
                      provider: "github",
                      callbackURL: "/",
                    },
                    {
                      onRequest: (_ctx) => {
                        setLoading(true);
                      },
                      onResponse: (_ctx) => {
                        setLoading(false);
                      },
                      onError: (_ctx) => {
                        toast.error("GitHub sign-in is not configured yet.");
                      },
                    }
                  );
                }}
                variant="outline"
              >
                <svg
                  height="1em"
                  viewBox="0 0 24 24"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
                    fill="currentColor"
                  />
                </svg>
                Sign in with Github
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex w-full justify-center border-t py-4">
            <p className="text-center text-neutral-500 text-xs">
              {"Don't have an account? "}
              <Link
                className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                href="/register"
              >
                Sign up
              </Link>
              {" for free."}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
