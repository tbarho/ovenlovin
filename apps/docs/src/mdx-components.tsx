import type { ReactNode } from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export function useMDXComponents(): Record<string, React.ComponentType<any>> {
  return {
    ...defaultMdxComponents,
  };
}

export default useMDXComponents;