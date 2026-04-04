import React, { useEffect, useState } from 'react';

/**
 * Gracefully load Vercel Speed Insights if it's installed.
 * - For Next.js users the package exports a React component under `@vercel/speed-insights/next`.
 * - For non-Next apps this will attempt to import `@vercel/speed-insights` and call any init/start function,
 *   or render the exported component if present.
 *
 * This component is safe to include even when the package is not installed.
 */
export default function SpeedInsightsWrapper(): JSX.Element | null {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Try generic package first
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = await import('@vercel/speed-insights').catch(() => null);
        if (!mod) {
          // Try Next-specific path (if someone installed that)
          const modNext = await import('@vercel/speed-insights/next').catch(() => null);
          if (modNext) {
            const S = modNext?.SpeedInsights || modNext?.default || null;
            if (S && mounted) setComp(() => S);
          }
          return;
        }

        // If module is a React component export, render it
        const S = mod?.SpeedInsights || mod?.default || null;
        if (S && (typeof S === 'function' || typeof S === 'object')) {
          if (mounted) setComp(() => S as React.ComponentType);
          return;
        }

        // If module exposes an init/start function, call it (best-effort)
        if (typeof mod.init === 'function') mod.init();
        else if (typeof mod.start === 'function') mod.start();
      } catch (err) {
        // ignore — optional integration
        // eslint-disable-next-line no-console
        console.warn('SpeedInsights not available or failed to initialize', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return null;
  return <Comp />;
}
