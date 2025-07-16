// src/app/popup/page.tsx
import { ChatView } from '../../components/Chat/ChatView';

export default function PopupChatPage() {
  return (
    // The main element should take full height of its parent (body, which is now h-full)
    // max-h and max-w will constrain it further if the iframe is larger.
    // overflow-hidden on main will ensure its own content doesn't cause scrollbars if ChatView misbehaves.
    <main className="flex flex-col h-full w-full max-h-[600px] max-w-[400px] mx-auto shadow-xl rounded-lg overflow-hidden border border-border bg-background">
      <ChatView isPopupMode={true} />
    </main>
  );
}
