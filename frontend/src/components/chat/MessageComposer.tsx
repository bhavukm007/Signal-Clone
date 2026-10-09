'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Paperclip, Send, Smile } from 'lucide-react';
import type { Attachment } from '@/types/models';

const EmojiPicker = dynamic(() => import('@/components/chat/EmojiPicker'), {
  ssr: false,
  loading: () => (
    <div className="emoji-picker-loading" role="status">
      Loading emoji…
    </div>
  ),
});

interface MessageComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onTyping: (value: string) => void;
  onSubmit: () => void;
  blocked: boolean;
  replyText?: string;
  onClearReply: () => void;
  attachments: Attachment[];
  onRemoveAttachment: (attachmentId: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export function MessageComposer({
  draft,
  onDraftChange,
  onTyping,
  onSubmit,
  blocked,
  replyText,
  onClearReply,
  attachments,
  onRemoveAttachment,
  onUpload,
}: MessageComposerProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const field = input.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? start;
    onDraftChange(`${draft.slice(0, start)}${emoji}${draft.slice(end)}`);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
  return (
    <div className="composer-wrap">
      {replyText !== undefined && (
        <div className="reply-preview">
          <span>Replying to {replyText || 'message'}</span>
          <button onClick={onClearReply}>×</button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="attachment-staging">
          {attachments.map((item) => (
            <span key={item.id}>
              📎 {item.file_name}
              <button
                aria-label={`Remove ${item.file_name}`}
                onClick={() => onRemoveAttachment(item.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer">
        <div className="emoji-control">
          <button
            className="icon-button"
            aria-label="Emoji"
            onClick={() => setEmojiOpen((value) => !value)}
          >
            <Smile />
          </button>
          {emojiOpen && <EmojiPicker className="emoji-picker-in-composer" onSelect={insertEmoji} />}
        </div>
        <textarea
          ref={input}
          value={draft}
          placeholder="Write a message…"
          rows={1}
          disabled={blocked}
          onChange={(event) => {
            onDraftChange(event.target.value);
            onTyping(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <label className="icon-button attach-button" aria-label="Attach file">
          <Paperclip />
          <input
            type="file"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await onUpload(file);
                event.target.value = '';
              }
            }}
          />
        </label>
        <button
          className="send-button"
          aria-label="Send"
          onClick={onSubmit}
          disabled={blocked || (!draft.trim() && !attachments.length)}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
