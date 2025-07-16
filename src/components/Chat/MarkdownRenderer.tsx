// src/components/Chat/MarkdownRenderer.tsx
"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none break-words"
      remarkPlugins={[remarkGfm]}
      components={{
        // Customize heading levels if needed, e.g., make them smaller
        h1: ({...props}) => <h2 className="text-xl font-semibold mt-2 mb-1" {...props} />,
        h2: ({...props}) => <h3 className="text-lg font-semibold mt-2 mb-1" {...props} />,
        h3: ({...props}) => <h4 className="text-base font-semibold mt-1 mb-1" {...props} />,
        // Ensure links open in new tabs and are styled appropriately
        a: ({...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        p: ({...props}) => <p className="mb-2 last:mb-0" {...props} />,
        ul: ({...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
        ol: ({...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
        li: ({...props}) => <li className="mb-1" {...props} />,
        code: ({className, children, ...props}) => {
          const match = /language-(\w+)/.exec(className || '')
          return match ? (
            <pre className={cn(className, "bg-muted p-2 rounded-md my-2 overflow-x-auto")}>
              <code className="text-sm">{children}</code>
            </pre>
          ) : (
            <code className={cn(className, "bg-muted text-sm px-1 py-0.5 rounded-sm")} {...props}>
              {children}
            </code>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Helper for cn function if not globally available in this file, or import from utils
// For simplicity, defining it here if this component is isolated.
// Better to import from "@/lib/utils"
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');
