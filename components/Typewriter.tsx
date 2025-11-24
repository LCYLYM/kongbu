import React, { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 50, onComplete }) => {
  const [displayedText, setDisplayedText] = useState<string>("");
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDisplayedText("");
    indexRef.current = 0;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const typeChar = () => {
      if (indexRef.current < text.length) {
        const char = text.charAt(indexRef.current);
        setDisplayedText((prev) => prev + char);
        indexRef.current++;

        // Randomize typing speed for "human" or "ghostly" feel
        let delay = speed + (Math.random() * 50 - 25);
        if (['，', '。', '？', '！'].includes(char)) delay += 300; // Pause at punctuation

        timeoutRef.current = setTimeout(typeChar, delay);
      } else {
        if (onComplete) onComplete();
      }
    };

    timeoutRef.current = setTimeout(typeChar, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, speed, onComplete]);

  return (
    <div className="text-stone-300 font-serif text-lg md:text-2xl leading-loose tracking-widest drop-shadow-lg whitespace-pre-wrap">
       {/* The container in App.tsx controls writing-mode, this just renders the text stream */}
       {displayedText}
       <span className="animate-pulse text-red-800 ml-1">▐</span>
    </div>
  );
};

export default Typewriter;