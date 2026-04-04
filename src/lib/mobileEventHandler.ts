/**
 * Mobile-safe event handler wrapper to prevent DOM race conditions
 * especially with Radix UI on touch devices
 */

export function createMobileSafeEventHandler<T extends React.SyntheticEvent>(
  handler: (e: T) => void,
  options = { logErrors: false }
): (e: T) => void {
  return (e: T) => {
    try {
      // Add small requestAnimationFrame delay to allow DOM to settle
      // This helps prevent race conditions on slow mobile devices
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          try {
            handler(e);
          } catch (err) {
            if (options.logErrors) {
              console.warn('Event handler error (in RAF):', err);
            }
          }
        });
      } else {
        handler(e);
      }
    } catch (err) {
      if (options.logErrors) {
        console.warn('Event handler wrapper error:', err);
      }
    }
  };
}

/**
 * Returns true if the app is running on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Safely prevents event propagation and default behavior
 * Handles potential null/undefined target errors
 */
export function safePrevents(e: React.SyntheticEvent): void {
  try {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  } catch (err) {
    console.warn('Error in safePrevents:', err);
  }
}

/**
 * Wraps a click handler to be safe on mobile
 */
export function mobileSafeClick<T extends React.MouseEvent>(
  handler: (e: T) => void
): (e: T) => void {
  return createMobileSafeEventHandler(handler, { logErrors: false });
}
