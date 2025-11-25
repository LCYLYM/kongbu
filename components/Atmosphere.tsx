import React, { useEffect, useState } from 'react';

interface AtmosphereProps {
  flashTrigger: boolean;
}

export const Atmosphere: React.FC<AtmosphereProps> = ({ flashTrigger }) => {
  const [flicker, setFlicker] = useState(false);

  // Mouse Tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Ambiance Flicker (Faulty Lightbulb logic)
  useEffect(() => {
    const triggerFlicker = () => {
      if (Math.random() > 0.8) {
        setFlicker(true);
        // Rapid strobe effect
        let count = 0;
        const strobe = setInterval(() => {
          setFlicker(prev => !prev);
          count++;
          if (count > 6) {
            clearInterval(strobe);
            setFlicker(false);
          }
        }, 50);
      }
      setTimeout(triggerFlicker, Math.random() * 8000 + 4000);
    };
    triggerFlicker();
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 z-20 ${flashTrigger ? 'flash-active' : ''}`}>
      
      {/* 
         The Darkness Mask: 
         This element uses the radial-gradient in CSS to be transparent at cursor 
         and black everywhere else. It sits at Z-index 10 (defined in CSS).
      */}
      <div className="darkness-mask" />

      {/* Floating Dust Particles */}
      <div className="absolute inset-0 z-30 opacity-30 mix-blend-screen overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className="absolute bg-slate-300 rounded-full blur-[1px]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `float-dust ${10 + Math.random() * 20}s infinite linear`
            }}
          />
        ))}
      </div>

      {/* Full Blackout Flicker (Simulates lightbulb dying completely) */}
      <div 
        className={`absolute inset-0 bg-black z-40 transition-opacity duration-75 ${flicker ? 'opacity-95' : 'opacity-0'}`}
      />
      
      {/* Vignette Overlay for extra claustrophobia */}
      <div className="absolute inset-0 z-20 bg-[radial-gradient(circle,transparent_40%,black_100%)] opacity-80 pointer-events-none"></div>
    </div>
  );
};