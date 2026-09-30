import { Suspense } from "react";
import { env } from "@/lib/env";
import { SignUpForm } from "../auth-forms";

export const metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense>
      <SignUpForm googleEnabled={env.googleEnabled} />
    </Suspense>
  );
}
