import { CheckCircle2, MessageSquareText, MousePointerClick, Share2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";
import { getUser } from "@/lib/session";

const features = [
  {
    icon: Share2,
    title: "One link. No client logins.",
    body: "Send a review link by WhatsApp or email. Clients open it on their phone and review right away.",
  },
  {
    icon: MousePointerClick,
    title: "Pin-point feedback",
    body: "Clients tap to drop pins or draw boxes on the creative and comment on the exact caption words.",
  },
  {
    icon: CheckCircle2,
    title: "A clear yes, on record",
    body: "Every approval is locked to a version with name, time and IP. No more “we never approved that”.",
  },
  {
    icon: ShieldCheck,
    title: "Internal check before it ships",
    body: "Optional per-project internal approval, so nothing reaches the client before a teammate signs off.",
  },
  {
    icon: MessageSquareText,
    title: "Team chat built in",
    body: "Channels, DMs, threads and project discussions with a decision log, all next to the work.",
  },
  {
    icon: Users,
    title: "Organised the agency way",
    body: "Workspaces, clients, contacts and projects, with every approval in its place.",
  },
];

export default async function Home() {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <LinkButton href="/app">Open app</LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost">
                Sign in
              </LinkButton>
              <LinkButton href="/sign-up">Get started</LinkButton>
            </>
          )}
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-4xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
            Built for social media & creative agencies
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
            Client approvals, <span className="text-brand-600">without the chase.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600">
            Upload the creative, share one link, and get pinned feedback and a recorded approval, all from the client’s phone.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href={user ? "/app" : "/sign-up"} size="lg">
              {user ? "Go to your workspace" : "Create your agency workspace"}
            </LinkButton>
            {!user ? (
              <Link href="/sign-in" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                I already have an account →
              </Link>
            ) : null}
          </div>
        </section>
        <section className="border-t border-zinc-100 bg-zinc-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
                <f.icon className="h-6 w-6 text-brand-600" />
                <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="py-8 text-center text-xs text-zinc-400">© {new Date().getFullYear()} Approval OS</footer>
    </div>
  );
}
