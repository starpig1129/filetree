import { useState, useCallback, useRef, useEffect } from 'react';

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

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

  const updateSelection = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    
    // Convert client coordinates to container content coordinates
    const contentX = clientX - rect.left + scrollLeft;
    const contentY = clientY - rect.top + scrollTop;

    const newBox = {
      x1: Math.min(startPos.current.x, contentX),
      y1: Math.min(startPos.current.y, contentY),
      x2: Math.max(startPos.current.x, contentX),
      y2: Math.max(startPos.current.y, contentY)
    };
    
    setSelectionBox(newBox);

    const items = containerRef.current.querySelectorAll(itemSelector);
    const selected: number[] = [];
    
    items.forEach((item, index) => {
      const itemRect = item as HTMLElement;
      // offsetLeft/Top are relative to the 'relative' parent (the container)
      const itX = itemRect.offsetLeft;
      const itY = itemRect.offsetTop;
      const itW = itemRect.offsetWidth;
      const itH = itemRect.offsetHeight;

      if (
        newBox.x1 < itX + itW &&
        newBox.x2 > itX &&
        newBox.y1 < itY + itH &&
        newBox.y2 > itY
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
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;
    
    startPos.current = { x, y };
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);
    
    setIsDragging(true);
    setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
  }, [containerRef, itemSelector]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"]')) return;
    
    // If clicking on an item (that is draggable), don't start selection box
    if (target.closest(itemSelector)) return;
    
    if (!containerRef.current) return;
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left + containerRef.current.scrollLeft;
    const y = touch.clientY - rect.top + containerRef.current.scrollTop;
    
    startPos.current = { x, y };
    lastPointerPos.current = { x: touch.clientX, y: touch.clientY };
    hasMoved.current = false;
    isPointerOnItem.current = !!target.closest(itemSelector);
    
    setIsDragging(true);
    setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
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
          containerRef.current.scrollTop += deltaY;
          containerRef.current.scrollLeft += deltaX;
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
