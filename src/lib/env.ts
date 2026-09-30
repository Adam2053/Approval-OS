export const env = {
  appUrl: (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  emailFrom: process.env.EMAIL_FROM ?? "Approval OS <onboarding@resend.dev>",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 20),
};
