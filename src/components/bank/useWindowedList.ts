import { useState, useEffect, useMemo, RefObject } from 'react';

export interface UseWindowedListOptions {
  estimatedItemHeight?: number;
  overscan?: number;
  threshold?: number;
}

export interface WindowedListResult<T> {
  visibleItems: { item: T; index: number }[];
  totalHeight: number;
  offsetY: number;
  startIndex: number;
  endIndex: number;
}

export function useWindowedList<T>(
  items: readonly T[],
  containerRef: RefObject<HTMLElement | null>,
  options: UseWindowedListOptions = {}
): WindowedListResult<T> {
  const { estimatedItemHeight = 130, overscan = 5, threshold = 25 } = options;

  const [scrollState, setScrollState] = useState<{ scrollTop: number; clientHeight: number }>({
    scrollTop: 0,
    clientHeight: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScroll = () => {
      setScrollState({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
      });
    };

    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScroll();
      });
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateScroll);
      resizeObserver?.disconnect();
    };
  }, [containerRef]);

  return useMemo(() => {
    const totalCount = items.length;
    const totalHeight = totalCount * estimatedItemHeight;

    if (totalCount <= threshold || scrollState.clientHeight === 0) {
      const renderCount = totalCount <= threshold ? totalCount : Math.min(totalCount, threshold);
      const visible = items.slice(0, renderCount).map((item, index) => ({ item, index }));
      return {
        visibleItems: visible,
        totalHeight,
        offsetY: 0,
        startIndex: 0,
        endIndex: renderCount,
      };
    }

    const startIdx = Math.max(0, Math.floor(scrollState.scrollTop / estimatedItemHeight) - overscan);
    const endIdx = Math.min(
      totalCount,
      Math.ceil((scrollState.scrollTop + scrollState.clientHeight) / estimatedItemHeight) + overscan
    );

    const visible = items.slice(startIdx, endIdx).map((item, i) => ({
      item,
      index: startIdx + i,
    }));

    return {
      visibleItems: visible,
      totalHeight,
      offsetY: startIdx * estimatedItemHeight,
      startIndex: startIdx,
      endIndex: endIdx,
    };
  }, [items, estimatedItemHeight, overscan, threshold, scrollState]);
}
