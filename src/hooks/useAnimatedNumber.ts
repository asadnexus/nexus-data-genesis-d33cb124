import { useState, useEffect, useRef, useCallback } from "react";

export function useAnimatedNumber(endValue: number, duration = 1500) {
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.floor(endValue * easeOut));

      if (progress < 1) requestAnimationFrame(step);
      else setDisplayValue(endValue);
    };

    requestAnimationFrame(step);
  }, [endValue, duration]);

  useEffect(() => {
    const timer = setTimeout(animate, 100);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        hasAnimated.current = false;
        animate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [animate]);

  return displayValue;
}
