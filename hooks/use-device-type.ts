"use client";

import { useState, useEffect } from "react";

export const useDeviceType = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch events or coarse pointer media query
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

    setIsTouchDevice(hasTouch || hasCoarsePointer);

    // Optional: Add resize listener if pointer type can change dynamically
    // (less common, but possible with hybrid devices)
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const listener = (event: MediaQueryListEvent) => {
      setIsTouchDevice(hasTouch || event.matches);
    };
    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  return { isTouchDevice };
};
