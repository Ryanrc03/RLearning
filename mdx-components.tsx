import type { MDXComponents } from "mdx/types";
import { Children, isValidElement, type ReactNode } from "react";
import { createHeadingId } from "@/lib/headings";

function textContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return textContent(child.props.children);
      }
      return "";
    })
    .join("");
}

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  const nextId = createHeadingId();

  return {
    h2: ({ children, ...props }) => (
      <h2 {...props} id={props.id ?? nextId(textContent(children))}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 {...props} id={props.id ?? nextId(textContent(children))}>
        {children}
      </h3>
    ),
    ...components,
  };
}
