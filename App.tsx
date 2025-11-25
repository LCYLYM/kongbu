import React, { useState, useEffect, useRef } from 'react';
import { Atmosphere } from './components/Atmosphere';
import Typewriter from './components/Typewriter';
import { GameService } from './services/gameService';
import { AudioService, audioManager } from './services/audioService';
import { GameState, StoryResponse, ChatHistoryItem, GameSettings, LLMProvider } from './types';

// Default scary background
const DEFAULT_BG = "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=2037&auto=format&fit=crop";

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    history: [],
    currentImage: DEFAULT_BG,
    imageLoading: false,
    isGameOver: false,
    gameStarted: false,
    loadingText: false,
    error: null
  });

  const [currentResponse, setCurrentResponse] = useState<StoryResponse | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState<GameSettings>({
    provider: 'gemini',
    apiKey: '',
    baseUrl: ''
  });

  // Refs
  const gameService = useRef(new GameService(settings));
  const [hasInteracted, setHasInteracted] = useState(false);

  // Re-init service when settings change
  useEffect(() => {
    gameService.current = new GameService(settings);
  }, [settings]);

  // Initialize Game
  const startGame = async () => {
    if (!hasInteracted) {
      audioManager.init();
      setHasInteracted(true);
    }
    
    setGameState(prev => ({ ...prev, gameStarted: true, loadingText: true, error: null }));
    
    try {
      const response = await gameService.current.startNewGame();
      handleGameResponse(response);
    } catch (e) {
      console.error(e);
      setGameState(prev => ({ 
        ...prev, 
        loadingText: false, 
        error: "与彼岸的连接断开了... (Connection Error)" 
      }));
    }
  };

  // Handle Choice
  const handleChoice = async (choice: string) => {
    setGameState(prev => ({ ...prev, loadingText: true, error: null }));
    
    const newHistory = [...gameState.history, { role: 'user', text: choice } as ChatHistoryItem];
    
    try {
      const response = await gameService.current.continueStory(newHistory, choice);
      handleGameResponse(response);
    } catch (e) {
      console.error(e);
      setGameState(prev => ({ 
        ...prev, 
        loadingText: false,
        error: "心中的恐惧让你无法前行... (API Error: Please Retry)"
      }));
    }
  };

  // Process API Response
  const handleGameResponse = async (response: StoryResponse) => {
    // 1. Text Update
    setCurrentResponse(response);
    setGameState(prev => ({
      ...prev,
      history: [...prev.history, { role: 'model', text: response.narrative }],
      isGameOver: response.isGameOver,
      loadingText: false,
      error: null
    }));

    // 2. Visual Effects
    if (response.flashReveal) {
      setFlashTrigger(true);
      audioManager.playJumpscare();
      setTimeout(() => setFlashTrigger(false), 200);
    } else {
       audioManager.playHeartbeat();
    }

    // 3. Image Generation (Async)
    if (response.visualPrompt) {
      setGameState(prev => ({ ...prev, imageLoading: true }));
      const imageUrl = await gameService.current.generateImage(response.visualPrompt);
      if (imageUrl) {
        setGameState(prev => ({ ...prev, currentImage: imageUrl, imageLoading: false }));
      } else {
        setGameState(prev => ({ ...prev, imageLoading: false }));
      }
    }
  };

  // Settings Modal Component
  const SettingsModal = () => {
    if (!showSettings) return null;
    
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
        <div className="w-full max-w-md p-8 border border-red-900/50 bg-stone-950 text-stone-300 relative">
          <h2 className="text-2xl font-calligraphy text-red-800 mb-6">天机设定 (Settings)</h2>
          
          <div className="space-y-4 font-serif">
            <div>
              <label className="block text-sm mb-2 text-stone-500">模型 (Provider)</label>
              <div className="flex gap-4">
                <button 
                  onClick={() => setSettings(s => ({...s, provider: 'gemini'}))}
                  className={`px-4 py-2 border ${settings.provider === 'gemini' ? 'border-red-800 text-red-500' : 'border-stone-800 text-stone-600'}`}
                >
                  Gemini
                </button>
                <button 
                  onClick={() => setSettings(s => ({...s, provider: 'openai'}))}
                  className={`px-4 py-2 border ${settings.provider === 'openai' ? 'border-red-800 text-red-500' : 'border-stone-800 text-stone-600'}`}
                >
                  OpenAI
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-stone-500">API Key (Optional for Gemini)</label>
              <input 
                type="password"
                value={settings.apiKey || ''}
                onChange={(e) => setSettings(s => ({...s, apiKey: e.target.value}))}
                placeholder="sk-..."
                className="w-full bg-black border border-stone-800 p-2 focus:border-red-900 outline-none text-stone-400"
              />
            </div>
             
             {settings.provider === 'openai' && (
                <div>
                  <label className="block text-sm mb-2 text-stone-500">Base URL (Optional)</label>
                  <input 
                    type="text"
                    value={settings.baseUrl || ''}
                    onChange={(e) => setSettings(s => ({...s, baseUrl: e.target.value}))}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-black border border-stone-800 p-2 focus:border-red-900 outline-none text-stone-400"
                  />
                </div>
             )}
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button 
              onClick={() => setShowSettings(false)}
              className="px-6 py-2 border border-stone-800 hover:border-red-800 hover:text-red-500 transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Shared Settings Button (Visible on both screens)
  const SettingsButton = () => (
    <div 
      onClick={() => setShowSettings(true)}
      className="fixed top-4 right-4 z-[90] opacity-40 hover:opacity-100 transition-opacity cursor-pointer p-2"
      title="Settings"
    >
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-300 hover:text-red-600 transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    </div>
  );

  // Render Intro Screen
  if (!gameState.gameStarted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-stone-400 relative">
        <SettingsButton />
        <SettingsModal />
        
        <div className="text-center z-50 p-8 border border-red-900/30 bg-black/80 backdrop-blur-sm max-w-md">
          <h1 className="font-calligraphy text-6xl text-red-900 mb-6 drop-shadow-[0_0_10px_rgba(220,20,60,0.8)]">
            幽冥录
          </h1>
          <p className="mb-8 font-serif text-lg tracking-widest opacity-70">
            佩戴耳机 · 关灯体验<br/>
            <span className="text-xs text-stone-600 mt-2 block">(Please enable audio)</span>
          </p>
          <button 
            onClick={startGame}
            className="px-8 py-3 border border-stone-700 hover:border-red-800 hover:text-red-700 transition-all duration-700 tracking-[0.5em] text-xl group relative overflow-hidden"
          >
            <span className="relative z-10">入局</span>
            <div className="absolute inset-0 bg-red-950 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out opacity-20"></div>
          </button>
        </div>
        <div className="fixed inset-0 z-0 opacity-40">
           <img src={DEFAULT_BG} className="w-full h-full object-cover filter grayscale blur-[2px]" alt="bg" />
        </div>
        <Atmosphere flashTrigger={false} />
      </div>
    );
  }

  // Render Game Screen
  return (
    <div className="relative h-screen w-full overflow-hidden select-none">
      <SettingsButton />
      <SettingsModal />
      
      {/* Layer 0: Background Image */}
      <div className="fixed inset-0 bg-black z-0">
        <img 
          src={gameState.currentImage} 
          alt="Atmosphere" 
          className={`w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${gameState.imageLoading ? 'opacity-40' : 'opacity-60'}`}
        />
        <div className="absolute inset-0 bg-black/50 mix-blend-multiply" />
      </div>

      {/* Layer 1: The Darkness Mask */}
      <Atmosphere flashTrigger={flashTrigger} />

      {/* Layer 2: UI & Narrative */}
      <div className="relative z-30 flex h-full items-center justify-center p-4 md:p-12 pointer-events-none">
        <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
          
          {/* Text Area */}
          <div className="paper-torn w-full md:w-2/3 min-h-[400px] flex items-center justify-center pointer-events-auto">
             <div className="writing-vertical text-left h-full w-full flex flex-col justify-center">
               
               {gameState.error ? (
                  <div className="flex flex-col items-center justify-center h-full gap-6 animate-pulse">
                    <p className="text-red-800 font-curse text-3xl writing-mode-horizontal text-center">{gameState.error}</p>
                    <button 
                      onClick={() => gameState.history.length > 0 ? handleChoice("尝试重新连接") : startGame()} 
                      className="border-b border-stone-700 hover:text-red-500 hover:border-red-500 transition-colors pb-1 text-lg"
                    >
                      重新凝视 (重试)
                    </button>
                  </div>
               ) : gameState.loadingText ? (
                 <div className="text-stone-600 animate-pulse text-center w-full mt-20">
                   <span className="font-calligraphy text-2xl">...</span>
                 </div>
               ) : (
                 currentResponse && (
                   <Typewriter 
                     text={currentResponse.narrative} 
                     speed={40} 
                   />
                 )
               )}
             </div>
          </div>

          {/* Action Area */}
          <div className="w-full md:w-1/3 flex flex-col gap-6 items-center justify-center pointer-events-auto mt-8 md:mt-0">
            {!gameState.loadingText && !gameState.error && currentResponse && !gameState.isGameOver && currentResponse.choices && (
               <div className="flex flex-col gap-4 w-full">
                  {currentResponse.choices?.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(choice)}
                      className="btn-gloom group relative px-6 py-4 border-l-2 border-stone-800 text-stone-400 text-lg font-serif text-left hover:border-red-900 transition-all duration-300 overflow-hidden"
                    >
                       <span className="relative z-10 group-hover:pl-2 transition-all duration-300">{choice}</span>
                    </button>
                  ))}
               </div>
            )}

            {gameState.isGameOver && !gameState.loadingText && (
              <button 
                onClick={() => window.location.reload()}
                className="mt-8 text-red-800 border-b border-red-900 pb-1 hover:text-red-600 transition-colors font-calligraphy text-2xl"
              >
                重新轮回
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;