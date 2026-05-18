import { ModeSurface } from "../../modes/components/ModeSurface";

interface ChatConversationViewProps {
  activeChatId: string | null;
}

export function ChatConversationView({ activeChatId: _activeChatId }: ChatConversationViewProps) {
  return <ModeSurface />;
}
