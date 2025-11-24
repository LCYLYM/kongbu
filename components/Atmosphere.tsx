import React, { useEffect, useState } from 'react';

interface AtmosphereProps {
  flashTrigger: boolean;
}

export const Atmosphere: React.FC<AtmosphereProps> = ({ flashTrigger }) => {
  const [flicker, setFlicker] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Handle the external Flash Reveal trigger
  useEffect(() => {
    if (flashTrigger) {
      setIsFlashing(true);
      const timeout = setTimeout(() => setIsFlashing(false), 200); // Quick flash (200ms)
      return () => clearTimeout(timeout);
    }
  }, [flashTrigger]);

  // Mouse Tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Random ambiance flicker (broken bulb effect)
  useEffect(() => {
    const triggerFlicker = () => {
      if (Math.random() > 0.7) {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 100 + Math.random() * 200);
      }
      setTimeout(triggerFlicker, Math.random() * 5000 + 2000);
    };
    triggerFlicker();
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 z-0 overflow-hidden select-none ${isFlashing ? 'flash-active' : ''}`}>
      
      {/* 1. The Darkness & Flashlight Mask */}
      <div className="absolute inset-0 darkness-layer transition-colors duration-1000" />
      
      {/* 2. The Light Beam Center (Add glow) */}
      <div className="absolute inset-0 light-beam" />

      {/* 3. Floating Dust Particles */}
      <div className="absolute inset-0 opacity-20 z-10">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="dust-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 20}s`
            }}
          />
        ))}
      </div>

      {/* 4. Ambiance Flicker (Blackout) */}
      <div 
        className={`absolute inset-0 bg-black z-30 transition-opacity duration-50 ${flicker ? 'opacity-80' : 'opacity-0'}`}
      />
    </div>
  );
};