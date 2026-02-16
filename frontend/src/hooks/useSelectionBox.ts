import { useState, useCallback, useRef, useEffect } from 'react';

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Selection box hook that uses **viewport (client) coordinates** for both
 * rendering and hit-testing. The returned `selectionBox` should be rendered
 * with `position: fixed` so that it aligns with the pointer regardless of
 * which nested element actually scrolls (e.g. Virtuoso's internal scroller).
 */
export const useSelectionBox = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  itemSelector: string,
  onSelectionChange: (result: { visibleIds: string[]; intersectingIds: string[] }) => void,
  onSelectionClear?: () => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startScrollPos = useRef({ top: 0, left: 0 });
  const hasMoved = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const scrollRequestRef = useRef<number | null>(null);
  const isPointerOnItem = useRef(false);

  const getScroller = useCallback(() => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector('[data-testid="virtuoso-scroller"], .custom-scrollbar') as HTMLElement | null || containerRef.current;
  }, [containerRef]);

  /**
   * Compute the selection rectangle in viewport coords and test which items
   * it intersects using `getBoundingClientRect()` (also viewport coords).
   */
  const updateSelection = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const scroller = getScroller();
    let deltaX = 0;
    let deltaY = 0;

    if (scroller) {
      deltaX = scroller.scrollLeft - startScrollPos.current.left;
      deltaY = scroller.scrollTop - startScrollPos.current.top;
    }

    // Adjust start position by scroll delta to keep it "attached" to the content
    // If we scrolled down (scrollTop increased), the start point moves UP relative to viewport.
    const effectiveStartX = startPos.current.x - deltaX;
    const effectiveStartY = startPos.current.y - deltaY;

    // Logical Selection Box (Full Range)
    const newBox = {
      x1: Math.min(effectiveStartX, clientX),
      y1: Math.min(effectiveStartY, clientY),
      x2: Math.max(effectiveStartX, clientX),
      y2: Math.max(effectiveStartY, clientY)
    };

    // Visual Selection Box (Clamped to Container)
    const containerRect = containerRef.current.getBoundingClientRect();
    const clampedBox = {
      x1: Math.max(newBox.x1, containerRect.left),
      y1: Math.max(newBox.y1, containerRect.top),
      x2: Math.min(newBox.x2, containerRect.right),
      y2: Math.min(newBox.y2, containerRect.bottom)
    };

    setSelectionBox(clampedBox);

    // Hit-test items using their viewport rects
    // NOTE: We use newBox (Logical) for intersection to ensure buffer items
    // (which might be slightly off-screen but in DOM) are correctly handled.
    const items = containerRef.current.querySelectorAll(itemSelector);
    const visibleIds: string[] = [];
    const intersectingIds: string[] = [];

    items.forEach((item) => {
      const id = item.getAttribute('data-id');
      if (!id) return;

      visibleIds.push(id);
      
      const r = item.getBoundingClientRect();
      if (
        newBox.x1 < r.right &&
        newBox.x2 > r.left &&
        newBox.y1 < r.bottom &&
        newBox.y2 > r.top
      ) {
        intersectingIds.push(id);
      }
    });

    onSelectionChange({ visibleIds, intersectingIds });
  }, [containerRef, itemSelector, onSelectionChange, getScroller]);


  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;

    // If clicking on an item (that is draggable), don't start selection box
    if (target.closest(itemSelector)) return;

    if (!containerRef.current) return;
    
    const scroller = getScroller();
    startScrollPos.current = { 
      top: scroller?.scrollTop || 0, 
      left: scroller?.scrollLeft || 0 
    };

    // Store start position in viewport coordinates
    startPos.current = { x: e.clientX, y: e.clientY };
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);

    setIsDragging(true);
    // Initial box is zero usage, but we set it to current pos
    setSelectionBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
  }, [containerRef, itemSelector, getScroller]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;

    // If clicking on an item (that is draggable), don't start selection box
    if (target.closest(itemSelector)) return;

    if (!containerRef.current) return;

    const scroller = getScroller();
    startScrollPos.current = { 
      top: scroller?.scrollTop || 0, 
      left: scroller?.scrollLeft || 0 
    };

    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    lastPointerPos.current = { x: touch.clientX, y: touch.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);

    setIsDragging(true);
    setSelectionBox({ x1: touch.clientX, y1: touch.clientY, x2: touch.clientX, y2: touch.clientY });
  }, [containerRef, itemSelector, getScroller]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    hasMoved.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    updateSelection(e.clientX, e.clientY);
  }, [isDragging, containerRef, updateSelection]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    hasMoved.current = true;
    const touch = e.touches[0];
    lastPointerPos.current = { x: touch.clientX, y: touch.clientY };
    updateSelection(touch.clientX, touch.clientY);
  }, [isDragging, containerRef, updateSelection]);

  const handlePointerUp = useCallback(() => {
    if (isDragging && !hasMoved.current && !isPointerOnItem.current) {
      // Empty click on container - deselect all
      if (onSelectionClear) {
        onSelectionClear();
      } else {
        // Fallback for backward compatibility (though likely logic-breaking for Delta Update consumers)
        onSelectionChange({ visibleIds: [], intersectingIds: [] });
      }
    }

    setIsDragging(false);
    setSelectionBox(null);
    if (scrollRequestRef.current) {
      cancelAnimationFrame(scrollRequestRef.current);
      scrollRequestRef.current = null;
    }
  }, [isDragging, onSelectionChange, onSelectionClear]);

  useEffect(() => {
    if (isDragging) {
      const scrollLoop = () => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const { x, y } = lastPointerPos.current;
        const threshold = 50;
        const maxSpeed = 15;

        let deltaY = 0;
        let deltaX = 0;

        if (y < rect.top + threshold) {
          deltaY = -Math.max(1, Math.min(maxSpeed, (rect.top + threshold - y) / 2));
        } else if (y > rect.bottom - threshold) {
          deltaY = Math.max(1, Math.min(maxSpeed, (y - (rect.bottom - threshold)) / 2));
        }

        if (x < rect.left + threshold) {
          deltaX = -Math.max(1, Math.min(maxSpeed, (rect.left + threshold - x) / 2));
        } else if (x > rect.right - threshold) {
          deltaX = Math.max(1, Math.min(maxSpeed, (x - (rect.right - threshold)) / 2));
        }

        if (deltaY !== 0 || deltaX !== 0) {
          // Scroll the deepest scrollable element inside the container
          const scroller = getScroller();
          if (scroller) {
            scroller.scrollTop += deltaY;
            scroller.scrollLeft += deltaX;
          } 

          // Note: we must correct coordinates if we wanted them relative,
          // but since we rely on getBoundingClientRect (viewport), we just pass client info.
          // However, mouse doesn't move. So we just re-run updateSelection with last pos.
          // But effectively, item rects changed, so intersections change.
          updateSelection(lastPointerPos.current.x, lastPointerPos.current.y);
        }

        scrollRequestRef.current = requestAnimationFrame(scrollLoop);
      };

      scrollRequestRef.current = requestAnimationFrame(scrollLoop);

      const upHandler = () => handlePointerUp();
      window.addEventListener('pointerup', upHandler);
      window.addEventListener('touchend', upHandler);

      return () => {
        if (scrollRequestRef.current) cancelAnimationFrame(scrollRequestRef.current);
        window.removeEventListener('pointerup', upHandler);
        window.removeEventListener('touchend', upHandler);
      };
    }
  }, [isDragging, containerRef, updateSelection, handlePointerUp, getScroller]);

  return {
    isDragging,
    selectionBox,
    handlePointerDown,
    handlePointerMove,
    handleTouchStart,
    handleTouchMove,
    handlePointerUp
  };
};
