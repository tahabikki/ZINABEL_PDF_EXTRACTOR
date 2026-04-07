/**
 * Performance utilities for smooth animations and efficient rendering
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Debounce hook for search inputs and filter changes
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook for scroll and resize events
 */
export function useThrottle<T>(value: T, delay: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, delay]);

  return throttledValue;
}

/**
 * Stable callback wrapper that prevents re-renders
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Return a stable wrapper that forwards arguments and return value with proper types
  return useCallback(((...args: Parameters<T>): ReturnType<T> => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (callbackRef.current as T)(...args) as ReturnType<T>;
  }) as T, []);
}

/**
 * Optimized animation frame handler
 */
export function useAnimationFrame(callback: (deltaTime: number) => void, isActive: boolean = true) {
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isActive) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;
      callback(deltaTime);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isActive, callback]);
}
