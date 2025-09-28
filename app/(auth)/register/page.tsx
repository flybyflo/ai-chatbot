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
import { signUp } from "@/lib/auth-client";

export default function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <Card className="z-50 w-full max-w-md rounded-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Sign Up</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Enter your information to create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  onChange={(e) => {
                    setFirstName(e.target.value);
                  }}
                  placeholder="Max"
                  required
                  value={firstName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  onChange={(e) => {
                    setLastName(e.target.value);
                  }}
                  placeholder="Robinson"
                  required
                  value={lastName}
                />
              </div>
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete="new-password"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Confirm Password</Label>
              <Input
                autoComplete="new-password"
                id="password_confirmation"
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Confirm Password"
                type="password"
                value={passwordConfirmation}
              />
            </div>
            <Button
              className="w-full"
              disabled={loading || password !== passwordConfirmation}
              onClick={async () => {
                if (password !== passwordConfirmation) {
                  toast.error("Passwords do not match!");
                  return;
                }

                await signUp.email({
                  email,
                  password,
                  name: `${firstName} ${lastName}`,
                  callbackURL: "/",
                  fetchOptions: {
                    onResponse: () => {
                      setLoading(false);
                    },
                    onRequest: () => {
                      setLoading(true);
                    },
                    onError: (ctx) => {
                      toast.error(
                        ctx.error.message || "Failed to create account!"
                      );
                    },
                    onSuccess: () => {
                      toast.success("Account created successfully!");
                      router.push("/");
                    },
                  },
                });
              }}
              type="submit"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Create an account"
              )}
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex w-full justify-center border-t py-4">
            <p className="text-center text-neutral-500 text-xs">
              {"Already have an account? "}
              <Link
                className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                href="/login"
              >
                Sign in
              </Link>
              {" instead."}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
