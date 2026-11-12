"use client";

import { useActionState, useState } from "react";

import { adminSignIn, type FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AdminLoginForm({ nextPath = "/admin/reports" }: { nextPath?: string }) {
  const [email, setEmail] = useState("admin@evergrace.example");
  const [password, setPassword] = useState("EverGrace!Admin1");
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    adminSignIn,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
      <Field label="Work email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="admin@evergrace.example"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        className="mt-4"
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {state?.message ? (
        <p className="mt-4 font-semibold text-warn" role="alert">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="dark" size="lg" className="mt-5 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in to admin"}
      </Button>
    </form>
  );
}
