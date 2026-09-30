import { Suspense } from "react";
import { env } from "@/lib/env";
import { SignInForm } from "../auth-forms";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense>
      <SignInForm googleEnabled={env.googleEnabled} />
    </Suspense>
  );
}
