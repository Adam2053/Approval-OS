"use client";

import {
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronsUpDown,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessagesSquare,
  Plus,
  Settings,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Menu, MenuItem } from "@/components/client-ui";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { cn, timeAgo } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";

type Ws = { name: string; slug: string; logoUrl: string | null };

export function Shell({
  workspace,
  workspaces,
  user,
  role,
  children,
}: {
  workspace: Ws;
  workspaces: Ws[];
  user: { name: string; email: string; image: string | null };
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The mobile menu stays open only on the page where it was opened, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const setMobileOpen = (open: boolean) => setOpenedOn(open ? pathname : null);
  const base = `/w/${workspace.slug}`;
  const { data: unread } = usePoll<{ total: number }>(`/api/w/${workspace.slug}/chat/unread`, 8000);
  const isChat = pathname.startsWith(`${base}/chat`);

  const nav = [
    { href: base, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${base}/approvals`, label: "Approvals", icon: FileCheck2 },
    { href: `${base}/clients`, label: "Clients", icon: Building2 },
    { href: `${base}/projects`, label: "Projects", icon: Briefcase },
    { href: `${base}/chat`, label: "Chat", icon: MessagesSquare, badge: unread?.total },
    { href: `${base}/team`, label: "Team", icon: Users },
    ...(role === "owner" || role === "admin" ? [{ href: `${base}/settings`, label: "Settings", icon: Settings }] : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Menu
          align="left"
          className="w-64"
          trigger={
            <button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-zinc-100">
              {workspace.logoUrl ? (
                <Avatar name={workspace.name} src={workspace.logoUrl} size={32} square />
              ) : (
                <LogoMark />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{workspace.name}</span>
                <span className="block text-xs capitalize text-zinc-500">{role}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-zinc-400" />
            </button>
          }
        >
          {() => (
            <>
              <div className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-400">Workspaces</div>
              {workspaces.map((w) => (
                <MenuItem key={w.slug} href={`/w/${w.slug}`}>
                  <Avatar name={w.name} src={w.logoUrl} size={20} square />
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.slug === workspace.slug ? <Check className="h-4 w-4 text-brand-600" /> : null}
                </MenuItem>
              ))}
              <div className="my-1 h-px bg-zinc-100" />
              <MenuItem href="/onboarding">
                <Plus className="h-4 w-4" /> New workspace
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-100 p-3">
        <UserMenu user={user} base={base} />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-50">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white lg:block">{sidebar}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute top-4 right-3 rounded-md p-1 text-zinc-400" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
          <button className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold lg:hidden">{workspace.name}</span>
          <div className="flex-1" />
          <NotificationBell slug={workspace.slug} />
        </header>
        <main className={cn("min-h-0 flex-1", isChat ? "overflow-hidden" : "overflow-y-auto")}>
          {isChat ? children : <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>}
        </main>
      </div>
    </div>
  );
}

function UserMenu({ user, base }: { user: { name: string; email: string; image: string | null }; base: string }) {
  const router = useRouter();
  return (
    <Menu
      align="left"
      className="bottom-full mb-1 w-56"
      trigger={
        <button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-zinc-100">
          <Avatar name={user.name} src={user.image} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-zinc-500">{user.email}</span>
          </span>
        </button>
      }
    >
      {() => (
        <>
          <MenuItem href={`${base}/profile`}>
            <UserCircle className="h-4 w-4" /> Profile
          </MenuItem>
          <MenuItem
            danger
            onClick={async () => {
              await authClient.signOut();
              router.push("/sign-in");
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function NotificationBell({ slug }: { slug: string }) {
  const router = useRouter();
  const { data, refresh } = usePoll<{ unread: number; items: NotificationItem[] }>(`/api/w/${slug}/notifications`, 15000);
  const markAll = useCallback(async () => {
    await fetch(`/api/w/${slug}/notifications`, { method: "POST", body: JSON.stringify({ all: true }) });
    refresh();
  }, [slug, refresh]);

  return (
    <Menu
      className="w-[min(22rem,calc(100vw-2rem))]"
      trigger={
        <button className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {data?.unread ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {data.unread > 9 ? "9+" : data.unread}
            </span>
          ) : null}
        </button>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {data?.unread ? (
              <button className="text-xs font-medium text-brand-600 hover:underline" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data?.items.length ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-500">You’re all caught up.</p>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "block w-full rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50",
                    !n.readAt && "bg-brand-50/60",
                  )}
                  onClick={async () => {
                    close();
                    if (!n.readAt)
                      await fetch(`/api/w/${slug}/notifications`, { method: "POST", body: JSON.stringify({ ids: [n.id] }) });
                    refresh();
                    if (n.link) router.push(n.link);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" /> : <span className="w-2" />}
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-800">{n.title}</div>
                      {n.body ? <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{n.body}</div> : null}
                      <div className="mt-1 text-[11px] text-zinc-400">{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Menu>
  );
}
