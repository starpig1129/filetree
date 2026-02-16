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

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Modern React (17+) does not need event.persist() for async access
      timerRef.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (shouldTriggerClick && !longPressTriggered && onClick) {
        onClick(event);
      }
      setLongPressTriggered(false);
    },
    [onClick, longPressTriggered]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: (e: React.TouchEvent) => {
      // Prevent browser from firing subsequent mouse/click events (ghost clicks)
      // This solves the issue where "Toggle Select" triggers twice (Select -> Deselect)
      if (e.cancelable) e.preventDefault();
      clear(e);
    },
  };
};
