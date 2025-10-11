"use client";

import { motion } from "motion/react";
import React, { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export type ContainerTextFlipProps = {
  /** Array of words to cycle through in the animation */
  words?: string[];
  /** Time in milliseconds between word transitions */
  interval?: number;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Additional CSS classes to apply to the text */
  textClassName?: string;
  /** Duration of the transition animation in milliseconds */
  animationDuration?: number;
};

export function ContainerTextFlip({
  words = ["better", "modern", "beautiful", "awesome"],
  interval = 3000,
  className,
  textClassName,
  animationDuration = 700,
}: Readonly<ContainerTextFlipProps>) {
  const id = useId();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [width, setWidth] = useState(100);
  const textRef = React.useRef(null);

  const updateWidthForWord = () => {
    if (textRef.current) {
      // Add some padding to the text width (30px on each side)
      // @ts-expect-error
      const textWidth = textRef.current.scrollWidth + 30;
      setWidth(textWidth);
    }
  };

  useEffect(() => {
    // Update width whenever the word changes
    updateWidthForWord();
  }, [currentWordIndex]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length);
      // Width will be updated in the effect that depends on currentWordIndex
    }, interval);

    return () => clearInterval(intervalId);
  }, [words, interval]);

  return (
    <motion.div
      animate={{ width }}
      className={cn(
        "relative inline-block rounded-lg pt-1 pb-2 text-center font-bold text-2xl text-black md:text-4xl dark:text-white",
        "[background:linear-gradient(135deg,#f9fafb_0%,#e5e7eb_50%,#d1d5db_100%)]",
        "shadow-[inset_0_-1px_#d1d5db,inset_0_0_0_1px_#d1d5db,_0_4px_8px_#d1d5db]",
        "dark:[background:linear-gradient(135deg,#6b7280_0%,#4b5563_25%,#374151_50%,#1f2937_75%,#111827_100%)]",
        "dark:shadow-[inset_0_-1px_#0f172a,inset_0_0_0_1px_#374151,_0_4px_8px_#00000052]",
        className
      )}
      key={words[currentWordIndex]}
      layout
      layoutId={`words-here-${id}`}
      transition={{ duration: animationDuration / 2000 }}
    >
      <motion.div
        className={cn("inline-block", textClassName)}
        layoutId={`word-div-${words[currentWordIndex]}-${id}`}
        ref={textRef}
        transition={{
          duration: animationDuration / 1000,
          ease: "easeInOut",
        }}
      >
        <motion.div className="inline-block">
          {words[currentWordIndex].split("").map((letter, index) => (
            <motion.span
              animate={{
                opacity: 1,
                filter: "blur(0px)",
              }}
              initial={{
                opacity: 0,
                filter: "blur(10px)",
              }}
              key={index}
              transition={{
                delay: index * 0.02,
              }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
