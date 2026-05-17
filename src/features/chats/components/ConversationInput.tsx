import { FileText, Paperclip, Send, StopCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChatStore } from "../../../shared/stores/chat.store";
import { useUIStore } from "../../../shared/stores/ui.store";
import { useCreateMessage } from "../hooks/use-chats";

interface ConversationInputProps {
  chatId: string;
  chatName?: string;
}

export function ConversationInput({ chatId, chatName }: ConversationInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasInput, setHasInput] = useState(false);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const createMessage = useCreateMessage(chatId);
  const isStreaming = useChatStore((s) => s.isStreaming && s.streamingChatId === chatId);
  const setCurrentInput = useChatStore((s) => s.setCurrentInput);
  const setInputDraft = useChatStore((s) => s.setInputDraft);
  const clearInputDraft = useChatStore((s) => s.clearInputDraft);
  const enterToSend = useUIStore((s) => s.enterToSendRP);

  const syncValue = useCallback(
    (value: string) => {
      setHasInput(value.trim().length > 0);
      setCurrentInput(value);
      if (value.trim()) setInputDraft(chatId, value);
      else clearInputDraft(chatId);
    },
    [chatId, clearInputDraft, setCurrentInput, setInputDraft],
  );

  useEffect(() => {
    const draft = useChatStore.getState().inputDrafts.get(chatId) ?? "";
    if (textareaRef.current) {
      textareaRef.current.value = draft;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
    syncValue(draft);
  }, [chatId, syncValue]);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = () => {
    const value = textareaRef.current?.value.trim() ?? "";
    if (!value) return;
    if (attachmentNames.length > 0) {
      toast.error("File attachments are waiting for the Rust assets/media backend slice.");
      return;
    }
    createMessage.mutate(
      { role: "user", content: value, characterId: null },
      {
        onSuccess: () => {
          if (textareaRef.current) {
            textareaRef.current.value = "";
            resize();
          }
          clearInputDraft(chatId);
          setCurrentInput("");
          setHasInput(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Message sending is waiting for the Rust chats backend slice.");
        },
      },
    );
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)]/70 px-4 py-3 backdrop-blur">
      {attachmentNames.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachmentNames.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
              <FileText size="0.75rem" />
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/85 p-2 shadow-sm">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            setAttachmentNames(files.map((file) => file.name));
            if (files.length > 0) toast.error("File attachments are waiting for the Rust assets/media backend slice.");
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-1 rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Attach files"
        >
          <Paperclip size="1rem" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={chatName ? `Message ${chatName}` : "Message"}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          onInput={(event) => {
            syncValue(event.currentTarget.value);
            resize();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (enterToSend || event.metaKey || event.ctrlKey) && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />

        <button
          type="button"
          onClick={() => {
            if (isStreaming) {
              toast.error("Generation cancellation is waiting for the Rust generation backend slice.");
              return;
            }
            handleSend();
          }}
          disabled={!isStreaming && (!hasInput || createMessage.isPending)}
          className="mb-1 rounded-lg bg-[var(--primary)] p-2 text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          title={isStreaming ? "Stop generation" : "Send message"}
        >
          {isStreaming ? <StopCircle size="1rem" /> : <Send size="1rem" />}
        </button>
      </div>
    </div>
  );
}
