import { useCallback, useRef, useState } from 'react';

interface Options {
  delay?: number;
}

/**
 * Custom hook to handle long-press gestures.
 * Supports both touch and mouse events.
 */
export const useLongPress = (
  onLongPress: (event: React.MouseEvent | React.TouchEvent) => void,
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void,
  { delay = 500 }: Options = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isCanceled = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      startPos.current = { x: clientX, y: clientY };
      isCanceled.current = false;

      timerRef.current = setTimeout(() => {
        if (!isCanceled.current) {
          onLongPress(event);
          setLongPressTriggered(true);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const handleMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!startPos.current || isCanceled.current) return;

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        isCanceled.current = true;
      }
    },
    []
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (shouldTriggerClick && !longPressTriggered && !isCanceled.current && onClick) {
        onClick(event);
      }
      setLongPressTriggered(false);
      startPos.current = null;
      isCanceled.current = false;
    },
    [onClick, longPressTriggered]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseMove: (e: React.MouseEvent) => handleMove(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchMove: (e: React.TouchEvent) => handleMove(e),
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      clear(e);
    },
  };
};
