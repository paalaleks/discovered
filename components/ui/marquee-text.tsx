"use client";

import React, { useState, useRef, useEffect } from "react";
import Measure from "react-measure";
import { cn } from "@/lib/utils";

interface MarqueeTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  pauseOnHover?: boolean;
  animationDuration?: number; // Duration in seconds for one full scroll cycle
}

const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  pauseOnHover = true,
  animationDuration = 10, // Default animation duration
  className,
  ...props
}) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textScrollWidth, setTextScrollWidth] = useState(0); // State for text width
  const textRef = useRef<HTMLSpanElement>(null); // Ref for the primary text span

  // Effect to check overflow and measure text width
  useEffect(() => {
    const checkSize = () => {
      if (containerWidth > 0 && textRef.current) {
        const currentTextScrollWidth = textRef.current.scrollWidth;
        const overflowing = currentTextScrollWidth > containerWidth + 1; // Add 1px buffer

        // Only update state if overflowing status changes
        setIsOverflowing((prev) => {
          if (prev !== overflowing) {
            console.log(
              `Marquee Check: Container=${containerWidth.toFixed(
                2
              )}, ScrollWidth=${currentTextScrollWidth.toFixed(
                2
              )}, Overflowing=${overflowing}, TextContent="${text.substring(
                0,
                30
              )}..."`
            );
            return overflowing;
          }
          return prev;
        });

        // Update text scroll width state if it changes
        setTextScrollWidth((prevWidth) => {
          if (prevWidth !== currentTextScrollWidth) {
            // console.log(`Measured Text Width: ${currentTextScrollWidth}`);
            return currentTextScrollWidth;
          }
          return prevWidth;
        });
      } else {
        // console.log("Marquee Waiting for measurements...");
      }
    };

    const animationFrameId = requestAnimationFrame(checkSize);
    return () => cancelAnimationFrame(animationFrameId);
  }, [containerWidth, text]); // Rerun when container width or text changes

  // Base animation style with CSS variable
  const baseAnimationStyle = isOverflowing
    ? ({ "--marquee-duration": `${animationDuration}s` } as React.CSSProperties)
    : {};

  // Dynamic style for the duplicate span
  const duplicateSpanStyle: React.CSSProperties = {
    ...baseAnimationStyle, // Include base animation duration
    position: "absolute",
    left: textScrollWidth ? `${textScrollWidth + 16}px` : "100%", // Dynamic left + 16px gap
  };

  return (
    <Measure
      bounds
      onResize={(contentRect) => {
        setContainerWidth(contentRect.bounds?.width || 0);
      }}
    >
      {({ measureRef: containerMeasureRef }) => (
        <div
          ref={containerMeasureRef}
          className={cn(
            "overflow-hidden whitespace-nowrap relative w-full group",
            className
          )}
          {...props}
        >
          {/* Primary text span */}
          <span
            ref={textRef}
            className={cn(
              "inline-block whitespace-nowrap", // Original classes
              isOverflowing && "animate-marquee will-change-transform",
              isOverflowing &&
                pauseOnHover &&
                "group-hover:[animation-play-state:paused]"
            )}
            style={baseAnimationStyle} // Apply only base animation style
          >
            {text}
          </span>

          {/* Duplicate text span for seamless loop */}
          {isOverflowing &&
            textScrollWidth > 0 && ( // Render only when overflowing and measured
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block whitespace-nowrap", // Base classes needed for width calculation consistency
                  "animate-marquee will-change-transform", // Animation class
                  pauseOnHover && "group-hover:[animation-play-state:paused]" // Pause on hover
                )}
                style={duplicateSpanStyle} // Apply dynamic position and animation style
              >
                {text}
              </span>
            )}
        </div>
      )}
    </Measure>
  );
};

export default MarqueeText;
