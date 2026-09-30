import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { emailLayout, sendEmail } from "./email";
import { env } from "./env";

function createAuth() {
  return betterAuth({
    appName: "Approval OS",
    baseURL: env.appUrl,
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-in-production-please",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        const { html, text } = emailLayout({
          heading: "Reset your password",
          lines: [`Hi ${user.name},`, "Click the button below to choose a new password. The link expires in 1 hour."],
          cta: { label: "Reset password", url },
        });
        await sendEmail({ to: user.email, subject: "Reset your Approval OS password", html, text });
      },
    },
    socialProviders: env.googleEnabled
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()),
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __aosAuth?: Auth };

/** Created lazily so the database (possibly embedded) is open before Better Auth touches it. */
export function getAuth(): Auth {
  g.__aosAuth ??= createAuth();
  return g.__aosAuth;
}
