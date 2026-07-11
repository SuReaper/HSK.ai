import { ChatView } from "@/components/chat-view";

// Cache Components: this route opts out of cached/instant navigation via
// `instant = false`, so the chat page is never cached while every other route
// keeps the default cache behaviour.
export const instant = false;

export default function Home() {
  return <ChatView />;
}
