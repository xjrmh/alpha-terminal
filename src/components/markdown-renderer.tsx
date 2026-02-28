"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const text = String(children);
    // Detect citation-style links like [1], [2], etc.
    const isCitation = /^\[\d+\]$/.test(text);

    if (isCitation) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="cite-link"
          {...props}
        >
          {text}
        </a>
      );
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
