"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

function normalizeMathDelimiters(content: string) {
  return content.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map((part, index) => index % 2 === 1 ? part : part
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$"))
    .join("");
}

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="message-content rich-message-content">
      <ReactMarkdown
        components={{
          a: ({ children, ...props }) => <a {...props} rel="noopener noreferrer" target="_blank">{children}</a>,
          pre: ({ children }) => <pre>{children}</pre>,
          table: ({ children }) => <div className="message-table-wrap"><table>{children}</table></div>,
        }}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        skipHtml
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
