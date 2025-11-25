import React, { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

// Strictly memoize to prevent "3x refresh" visual glitches when parent re-renders
const Typewriter: React.FC<TypewriterProps> = React.memo(({ text, speed = 50, onComplete }) => {
  const [displayedText, setDisplayedText] = useState<string>("");
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    // If text is same as fully displayed, don't restart (safety check)
    if (displayedText === text && text !== "") return;

    // Reset for new text
    setDisplayedText("");
    indexRef.current = 0;
    isTypingRef.current = true;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const typeChar = () => {
      if (!isTypingRef.current) return;

      if (indexRef.current < text.length) {
        const char = text.charAt(indexRef.current);
        setDisplayedText((prev) => prev + char);
        indexRef.current++;

        // Randomize speed for "ghostly" uneven typing
        let delay = speed + (Math.random() * 60 - 20);
        
        // Pause for punctuation
        if (['，', '。', '？', '！', '…', '\n'].includes(char)) delay += 300; 

        timeoutRef.current = setTimeout(typeChar, delay);
      } else {
        isTypingRef.current = false;
        if (onComplete) {
            onComplete();
        }
      }
    };

    // Initial start delay
    timeoutRef.current = setTimeout(typeChar, 100);

    return () => {
      isTypingRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text]); // Only dependency is text. Parent re-renders won't trigger this unless text changes.

  // Render logic to split first char for styling
  const firstChar = displayedText.charAt(0);
  const restText = displayedText.slice(1);

  return (
    <div className="text-ghost font-serif text-lg md:text-2xl whitespace-pre-wrap leading-relaxed tracking-widest" style={{ minHeight: '100px' }}>
       {displayedText.length > 0 && (
         <span className="text-blood font-curse text-4xl md:text-5xl mr-2 align-middle inline-block transform -translate-y-1">
           {firstChar}
         </span>
       )}
       {restText}
    </div>
  );
}, (prev, next) => {
  // Custom comparison: Only re-render if text prop is different
  return prev.text === next.text;
});

export default Typewriter;