// Shim for `next/navigation` used by optional packages when building in non-Next projects.
// Exports minimal stubs used by libraries like @vercel/speed-insights.

export function useParams(): Record<string, string> {
  return {};
}

export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    prefetch: () => Promise.resolve(),
  } as const;
}

export function usePathname(): string {
  return '';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams('');
}

export function useSelectedLayoutSegment(): null {
  return null;
}

export default {};
