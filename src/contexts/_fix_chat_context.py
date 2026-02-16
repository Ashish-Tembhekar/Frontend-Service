import os

filepath = os.path.join(os.path.dirname(__file__), 'ChatContext.tsx')
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Change 1: Replace auto-select most recent thread with fresh chat comment
old1 = '                // Auto-select the most recent thread if none is selected\n                if (!currentChatThreadId && threads.length > 0) {\n                    setCurrentChatThreadId(threads[0].id);\n                }'
new1 = '                // Always start with a fresh chat session on app load.\n                // Previous sessions are accessible via the history panel.'
if old1 in content:
    content = content.replace(old1, new1)
    print('Change 1 applied successfully')
else:
    print('ERROR: Change 1 target not found')

# Change 2: Replace history panel override effect
old2 = '    useEffect(() => {\n        if (typeof window !== \'undefined\') {\n            const storedState = window.localStorage.getItem(\'nexus_history_panel_open_v2\');\n            if (storedState === null) {\n                setIsHistoryPanelOpen(window.innerWidth >= 768);\n            }\n        }\n    }, []);'
new2 = '    // History panel is always initially hidden/collapsed.\n    // Users can toggle it open via the header button.\n    useEffect(() => {\n        setIsHistoryPanelOpen(false);\n    }, []);'
if old2 in content:
    content = content.replace(old2, new2)
    print('Change 2 applied successfully')
else:
    print('ERROR: Change 2 target not found')

# Change 3: Replace initial thread creation effect to always start new chat
old3 = '''    // Handle initial thread creation when Firestore loads with no threads
    useEffect(() => {
        if (!isFirestoreLoading && !user?.uid) return;

        // If Firestore loaded and there are no threads, and user is logged in, create one
        if (!isFirestoreLoading && chatThreads.length === 0 && user?.uid && !currentChatThreadId) {
            startNewChat();
        }

        // If current thread was deleted, switch to the most recent
        if (!isFirestoreLoading && chatThreads.length > 0 && currentChatThreadId) {
            const threadStillExists = chatThreads.some(t => t.id === currentChatThreadId);
            if (!threadStillExists) {
                const mostRecentThread = [...chatThreads].sort((a, b) =>
                    new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
                )[0];
                setCurrentChatThreadId(mostRecentThread.id);
            }
        }
    }, [isFirestoreLoading, chatThreads, currentChatThreadId, user?.uid, startNewChat]);'''
new3 = '''    // Handle initial thread creation on app load and thread deletion recovery.
    // Always starts a fresh "New Chat" session when the app loads, regardless of existing threads.
    const hasCreatedInitialThread = useRef(false);
    useEffect(() => {
        if (!isFirestoreLoading && !user?.uid) return;

        // On initial load (Firestore done loading, user is logged in), always start a new chat.
        // This ensures the user sees a fresh session instead of their last conversation.
        if (!isFirestoreLoading && user?.uid && !hasCreatedInitialThread.current) {
            hasCreatedInitialThread.current = true;
            startNewChat();
            return;
        }

        // If current thread was deleted, switch to the most recent or create a new one
        if (!isFirestoreLoading && currentChatThreadId && hasCreatedInitialThread.current) {
            const threadStillExists = chatThreads.some(t => t.id === currentChatThreadId);
            if (!threadStillExists) {
                if (chatThreads.length > 0) {
                    const mostRecentThread = [...chatThreads].sort((a, b) =>
                        new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
                    )[0];
                    setCurrentChatThreadId(mostRecentThread.id);
                } else {
                    startNewChat();
                }
            }
        }
    }, [isFirestoreLoading, chatThreads, currentChatThreadId, user?.uid, startNewChat]);'''
if old3 in content:
    content = content.replace(old3, new3)
    print('Change 3 applied successfully')
else:
    print('ERROR: Change 3 target not found')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('File saved.')
