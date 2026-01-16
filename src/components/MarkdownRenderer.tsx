import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mb-3 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mb-2 text-foreground">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base font-semibold mb-1 text-foreground">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="mb-2 text-foreground leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground">{children}</em>
        ),
        code: ({ inline, children, ...props }: any) =>
          inline ? (
            <code
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
              {...props}
            >
              {children}
            </code>
          ) : (
            <code
              className="block bg-muted p-3 rounded-lg text-sm font-mono text-foreground overflow-x-auto my-2"
              {...props}
            >
              {children}
            </code>
          ),
        pre: ({ children }) => (
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-5 mb-2 space-y-1 text-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-5 mb-2 space-y-1 text-foreground">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-foreground leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline font-medium"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border border-border rounded-lg">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-border">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-border">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-foreground">{children}</td>
        ),
        hr: () => <hr className="my-4 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};
