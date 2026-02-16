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
  onSelectionChange: (selectedIndices: number[]) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const scrollRequestRef = useRef<number | null>(null);
  const isPointerOnItem = useRef(false);

  /**
   * Compute the selection rectangle in viewport coords and test which items
   * it intersects using `getBoundingClientRect()` (also viewport coords).
   */
  const updateSelection = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    // Selection box in viewport (client) coordinates
    const newBox = {
      x1: Math.min(startPos.current.x, clientX),
      y1: Math.min(startPos.current.y, clientY),
      x2: Math.max(startPos.current.x, clientX),
      y2: Math.max(startPos.current.y, clientY)
    };

    setSelectionBox(newBox);

    // Hit-test items using their viewport rects
    const items = containerRef.current.querySelectorAll(itemSelector);
    const selected: number[] = [];

    items.forEach((item, index) => {
      const r = item.getBoundingClientRect();
      if (
        newBox.x1 < r.right &&
        newBox.x2 > r.left &&
        newBox.y1 < r.bottom &&
        newBox.y2 > r.top
      ) {
        selected.push(index);
      }
    });

    onSelectionChange(selected);
  }, [containerRef, itemSelector, onSelectionChange]);


  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;

    // If clicking on an item (that is draggable), don't start selection box
    if (target.closest(itemSelector)) return;

    if (!containerRef.current) return;

    // Store start position in viewport coordinates
    startPos.current = { x: e.clientX, y: e.clientY };
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);

    setIsDragging(true);
    setSelectionBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
  }, [containerRef, itemSelector]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;

    // If clicking on an item (that is draggable), don't start selection box
    if (target.closest(itemSelector)) return;

    if (!containerRef.current) return;

    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    lastPointerPos.current = { x: touch.clientX, y: touch.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);

    setIsDragging(true);
    setSelectionBox({ x1: touch.clientX, y1: touch.clientY, x2: touch.clientX, y2: touch.clientY });
  }, [containerRef, itemSelector]);

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
      onSelectionChange([]);
    }

    setIsDragging(false);
    setSelectionBox(null);
    if (scrollRequestRef.current) {
      cancelAnimationFrame(scrollRequestRef.current);
      scrollRequestRef.current = null;
    }
  }, [isDragging, onSelectionChange]);

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
          const scroller = containerRef.current.querySelector('[data-testid="virtuoso-scroller"], .custom-scrollbar') as HTMLElement | null;
          if (scroller) {
            scroller.scrollTop += deltaY;
            scroller.scrollLeft += deltaX;
          } else {
            containerRef.current.scrollTop += deltaY;
            containerRef.current.scrollLeft += deltaX;
          }
          updateSelection(x, y);
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
  }, [isDragging, containerRef, updateSelection, handlePointerUp]);

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
