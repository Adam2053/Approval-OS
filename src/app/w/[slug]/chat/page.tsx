import { MessagesSquare } from "lucide-react";

export const metadata = { title: "Chat" };

export default function ChatHome() {
  return (
    <div className="hidden h-full flex-col items-center justify-center bg-white p-8 text-center md:flex">
      <div className="rounded-full bg-brand-50 p-4 text-brand-600">
        <MessagesSquare className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-semibold">Team chat</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">Pick a channel, project discussion or direct message on the left. Use @ to mention teammates.</p>
    </div>
  );
}
