import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Atmosphere } from './components/Atmosphere';
import Typewriter from './components/Typewriter';
import { startNewGame, continueStory, generateSceneImage } from './services/geminiService';
import { StoryResponse, ChatHistoryItem } from './types';

// Ritualistic loading messages
const RITUAL_STEPS = [
  "三魂七魄归位...",
  "莫问吉凶...",
  "忌：回头...",
  "宜：入殓...",
  "香灰落地...",
  "纸人点睛..."
];

const App: React.FC = () => {
  // Game State
  const [gameStarted, setGameStarted] = useState(false);
  const [narrative, setNarrative] = useState<string>("");
  const [choices, setChoices] = useState<string[]>([]);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  
  // UI State
  const [isTyping, setIsTyping] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(false); // Triggers the jump scare

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Cycle through loading messages
  useEffect(() => {
    if (loadingAction) {
      let i = 0;
      setLoaderMessage(RITUAL_STEPS[0]);
      const interval = setInterval(() => {
        i = (i + 1) % RITUAL_STEPS.length;
        setLoaderMessage(RITUAL_STEPS[i]);
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [loadingAction]);

  const handleStoryResponse = useCallback((response: StoryResponse) => {
    // 1. Trigger Flash if needed (The Trap)
    if (response.flashReveal) {
      setFlashTrigger(true);
      setTimeout(() => setFlashTrigger(false), 300); // Reset quickly
    }

    // 2. Set Content
    setNarrative(response.narrative);
    setChoices(response.choices);
    setIsGameOver(response.isGameOver);
    setIsTyping(true); 
    setLoadingAction(false);

    setHistory(prev => [...prev, { role: 'model', text: JSON.stringify(response) }]);
    
    // 3. Generate Image
    if (response.visualPrompt) {
      generateSceneImage(response.visualPrompt).then((base64) => {
        if (base64) setCurrentImage(base64);
      });
    }
  }, []);

  const handleStartGame = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const response = await startNewGame();
      setGameStarted(true);
      setHistory([{ role: 'model', text: response.narrative }]); 
      handleStoryResponse(response);
    } catch (e) {
      setErrorMessage("阴路不通，请重试...");
      setLoadingAction(false);
    }
  };

  const handleChoice = async (choice: string) => {
    setLoadingAction(true);
    setErrorMessage(null);

    const newHistory = [...history, { role: 'user' as const, text: choice }];
    setHistory(newHistory);

    try {
      const response = await continueStory(newHistory, choice);
      handleStoryResponse(response);
    } catch (e) {
      setErrorMessage("鬼打墙了...");
      setLoadingAction(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      
      {/* 1. Background Scene (Blends into darkness) */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {currentImage && (
           <img 
             key={currentImage}
             src={currentImage} 
             alt="Scene" 
             className="w-full h-full object-cover opacity-60 mix-blend-luminosity filter blur-[1px] brightness-75 transition-all duration-[2000ms] ease-in-out scale-105"
           />
        )}
      </div>

      {/* 2. Atmosphere (Flashlight, Fog, Flash Reveal) */}
      <Atmosphere flashTrigger={flashTrigger} />

      {/* 3. Main UI Layer (Center "Spirit Tablet") */}
      <div className="relative z-40 w-full h-full flex flex-col md:flex-row items-center justify-center pointer-events-none">
        
        {/* Intro Screen */}
        {!gameStarted && !loadingAction && (
          <div className="pointer-events-auto flex flex-col items-center gap-10 z-50">
            <h1 className="text-8xl md:text-9xl font-calligraphy text-[#8a0000] drop-shadow-[0_0_25px_rgba(138,0,0,0.6)] animate-pulse vertical-text-md">
              幽冥录
            </h1>
            <button 
              onClick={handleStartGame}
              className="talisman-clip relative w-48 h-64 bg-[#d4c4a8] flex items-center justify-center group shadow-[0_0_30px_rgba(0,0,0,1)] hover:scale-105 transition-transform duration-300"
              style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/aged-paper.png")' }}
            >
              <div className="absolute inset-2 border-2 border-[#5c0000] opacity-50"></div>
              <span className="font-calligraphy text-5xl text-[#5c0000] writing-vertical">
                开启<br/>冥途
              </span>
            </button>
          </div>
        )}

        {/* Loading / Ritual Screen */}
        {loadingAction && (
           <div className="absolute z-50 flex flex-col items-center">
             <div className="font-curse text-4xl text-[#8a0000] animate-bounce">
               {loaderMessage}
             </div>
             <div className="mt-4 text-stone-500 text-sm tracking-[0.5em]">请勿闭眼</div>
           </div>
        )}

        {/* Gameplay Container - Stabilized Layout */}
        {gameStarted && !loadingAction && (
          <div className="relative w-full max-w-5xl h-[90vh] flex flex-col md:flex-row items-center justify-between p-4 md:p-12 gap-8">
            
            {/* Narrative Area (Spirit Tablet Style) */}
            <div 
              ref={scrollContainerRef}
              className="pointer-events-auto relative w-full md:w-2/3 h-[60vh] md:h-full bg-black/60 backdrop-blur-sm border-y-2 md:border-y-0 md:border-x-2 border-[#3f0000]/50 p-6 md:p-12 overflow-y-auto md:overflow-x-auto custom-scrollbar flex flex-col md:block"
            >
               {/* Vertical text on desktop, horizontal on mobile handled by CSS classes */}
               <div className="writing-vertical min-h-full mx-auto md:mx-0">
                  <Typewriter 
                    text={narrative} 
                    speed={45} 
                    onComplete={() => setIsTyping(false)} 
                  />
               </div>
            </div>

            {/* Interaction Area (Choices) */}
            <div className="pointer-events-auto w-full md:w-1/3 flex flex-col gap-6 items-center justify-center">
              
              {!isTyping && !isGameOver && choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChoice(choice)}
                  className="talisman-clip relative w-full max-w-[280px] bg-[#d4c4a8] py-6 px-4 shadow-xl transition-all duration-300 hover:scale-105 hover:rotate-1 group"
                  style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/aged-paper.png")' }}
                >
                  {/* Decorative Borders */}
                  <div className="absolute top-2 bottom-2 left-2 right-2 border border-[#5c0000] opacity-30"></div>
                  
                  {/* Text */}
                  <span className="relative z-10 font-calligraphy text-2xl text-[#3f0000] group-hover:text-[#8a0000] drop-shadow-sm block text-center">
                    {choice}
                  </span>
                  
                  {/* Blood stain on hover */}
                  <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/10 transition-colors duration-300"></div>
                </button>
              ))}

              {isGameOver && !isTyping && (
                <button 
                  onClick={() => window.location.reload()}
                  className="font-curse text-5xl text-red-600 animate-pulse mt-10 hover:text-red-500 transition-colors drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                >
                  再入轮回
                </button>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Custom Cursor Light (Follows mouse) */}
      <div 
        className="fixed w-2 h-2 bg-yellow-100 rounded-full blur-[1px] pointer-events-none z-[100] mix-blend-difference"
        style={{ 
            left: 'var(--cursor-x)', 
            top: 'var(--cursor-y)', 
            transform: 'translate(-50%, -50%)' 
        }}
      />
    </div>
  );
};

export default App;