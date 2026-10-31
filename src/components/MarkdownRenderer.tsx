import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose-zen leading-relaxed text-xs">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              attributes: {
                ...defaultSchema.attributes,
                span: [...(defaultSchema.attributes?.span || []), 'className'],
                div: [...(defaultSchema.attributes?.div || []), 'className'],
                code: [...(defaultSchema.attributes?.code || []), 'className'],
              },
            },
          ],
          [rehypeKatex, { trust: false, maxExpand: 1000, maxSize: 20, strict: 'error' }],
        ]}
        components={{
          img: ({ alt }) => <span>{alt || '[Image omitted in offline mode]'}</span>,
          a: ({ children }) => <span>{children}</span>,
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-2 mb-3 pb-2 border-b border-zen-700/50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-zen-100 mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zen-400 mt-3 mb-1.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-xs text-zen-200/90 leading-relaxed my-2">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-xs text-zen-200 space-y-1 mb-3 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-xs text-zen-200 space-y-1 mb-3 pl-2">
              {children}
            </ol>
          ),
          hr: () => <hr className="border-zen-800 my-4" />,
          code: ({ className, children }) => {
            const isInline = !className?.includes('language-');
            if (isInline) {
              return (
                <code className="bg-zen-800 text-sky-300 px-1.5 py-0.5 rounded text-xs font-mono border border-zen-750">
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 bg-zen-950 rounded-lg border border-zen-800 font-mono text-xs text-zen-100 overflow-x-auto my-3 leading-relaxed">
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
