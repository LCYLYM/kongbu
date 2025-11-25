
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Atmosphere } from './components/Atmosphere';
import Typewriter from './components/Typewriter';
import { SettingsModal } from './components/SettingsModal';
import { GameService } from './services/gameService';
import { audioManager } from './services/audioService';
import { GameState, StoryResponse, ChatHistoryItem, GameSettings } from './types';

// Default scary background
const DEFAULT_BG = "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=2037&auto=format&fit=crop";

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    history: [],
    inventory: [], // Inventory System
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
  
  // Settings State - Default to gemini-2.5-flash, but try to load from storage
  const [settings, setSettings] = useState<GameSettings>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    imageModel: 'gemini-2.5-flash-image',
    apiKey: '',
    baseUrl: '',
    useSharedCache: true // Default Enabled
  });

  // Load settings on mount
  useEffect(() => {
    const savedSettings = GameService.loadSettingsFromStorage();
    if (savedSettings) {
        setSettings(savedSettings);
    }
  }, []);

  // Service Instance - Memoized
  const gameService = useMemo(() => new GameService(settings), []); 

  // Update service when settings change
  useEffect(() => {
    gameService.updateSettings(settings);
  }, [settings, gameService]);

  const [hasInteracted, setHasInteracted] = useState(false);

  // --- Event Handlers ---

  const startGame = useCallback(async () => {
    if (!hasInteracted) {
      audioManager.init();
      setHasInteracted(true);
    }
    
    setGameState(prev => ({ ...prev, gameStarted: true, loadingText: true, error: null, history: [], inventory: [] }));
    
    try {
      const response = await gameService.startNewGame();
      handleGameResponse(response);
    } catch (e) {
      console.error(e);
      setGameState(prev => ({ 
        ...prev, 
        loadingText: false, 
        error: "与彼岸的连接断开了... (Connection Error)" 
      }));
    }
  }, [gameService, hasInteracted]);

  const handleChoice = useCallback(async (choice: string) => {
    setGameState(prev => ({ ...prev, loadingText: true, error: null }));
    
    // Construct new history immediately for the UI/Service call
    const newHistory = [...gameState.history, { role: 'user', text: choice } as ChatHistoryItem];
    
    try {
      // Pass Inventory Context
      const response = await gameService.continueStory(newHistory, choice, gameState.inventory);
      
      setGameState(prev => ({
        ...prev,
        history: newHistory
      }));
      
      handleGameResponse(response);
    } catch (e) {
      console.error(e);
      setGameState(prev => ({ 
        ...prev, 
        loadingText: false,
        error: "心中的恐惧让你无法前行... (API Error: Please Retry)"
      }));
    }
  }, [gameState.history, gameState.inventory, gameService]);

  // Process API Response & Trigger Side Effects
  const handleGameResponse = (response: StoryResponse) => {
    setCurrentResponse(response);
    
    // Update Inventory
    let newInventory = [...gameState.inventory];
    if (response.inventoryUpdates) {
        if (response.inventoryUpdates.add) {
            response.inventoryUpdates.add.forEach(item => {
                if (!newInventory.includes(item)) newInventory.push(item);
            });
        }
        if (response.inventoryUpdates.remove) {
            newInventory = newInventory.filter(item => !response.inventoryUpdates?.remove?.includes(item));
        }
    }

    setGameState(prev => ({
      ...prev,
      history: [...prev.history, { role: 'model', text: response.narrative }],
      inventory: newInventory,
      isGameOver: response.isGameOver,
      loadingText: false,
      error: null
    }));

    // Audio & Visual FX
    if (response.flashReveal) {
      setFlashTrigger(true);
      audioManager.playJumpscare();
      setTimeout(() => setFlashTrigger(false), 200);
    } else {
       audioManager.playHeartbeat();
    }

    // Image Gen - Always trigger, even if cached (GameService handles the caching check)
    if (response.visualPrompt) {
      setGameState(prev => ({ ...prev, imageLoading: true }));
      gameService.generateImage(response.visualPrompt).then(imageUrl => {
        if (imageUrl) {
            setGameState(prev => ({ ...prev, currentImage: imageUrl, imageLoading: false }));
        } else {
            setGameState(prev => ({ ...prev, imageLoading: false }));
        }
      });
    }
  };

  // Trigger Preloading when Typewriter finishes
  const onNarrativeComplete = useCallback(() => {
    if (currentResponse && currentResponse.choices && !gameState.isGameOver) {
      // Preload with CURRENT state (which is the state AFTER the last response).
      gameService.preloadChoices(gameState.history, currentResponse.choices, gameState.inventory);
    }
  }, [currentResponse, gameState.history, gameState.inventory, gameState.isGameOver, gameService]);

  // Shared Settings Button
  const SettingsButton = () => (
    <div 
      onClick={() => setShowSettings(true)}
      className="fixed top-4 right-4 z-[90] opacity-40 hover:opacity-100 transition-opacity cursor-pointer p-2"
      title="Settings"
    >
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-300 hover:text-red-600 transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    </div>
  );

  // Inventory UI Component - Now always visible in the corner as an icon, expanding on hover
  const InventoryDisplay = () => {
    return (
        <div className="fixed bottom-8 right-8 z-40 flex flex-col items-end group">
            <div className="flex flex-col-reverse gap-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                {gameState.inventory.length > 0 ? (
                    gameState.inventory.map((item, idx) => (
                        <div key={idx} className="bg-black/90 border border-red-900/40 text-stone-300 px-4 py-2 font-serif text-sm shadow-lg whitespace-nowrap">
                            <span className="text-red-500 mr-2">✦</span>{item}
                        </div>
                    ))
                ) : (
                    <div className="text-stone-600 font-serif text-sm italic pr-2 bg-black/80 px-2 py-1">行囊空空...</div>
                )}
            </div>
            
            {/* Bag Icon / Label */}
            <div className="flex items-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105">
                <span className="font-calligraphy text-red-600 text-xl writing-vertical-rl drop-shadow-[0_0_5px_rgba(220,20,60,0.5)]">行囊</span>
                <div className="w-12 h-12 border border-stone-800 hover:border-red-800 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                    <span className="text-stone-300 text-sm font-bold">{gameState.inventory.length}</span>
                </div>
            </div>
        </div>
    );
  };

  // --- Render ---

  if (!gameState.gameStarted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-stone-400 relative">
        <SettingsButton />
        <SettingsModal 
          show={showSettings} 
          onClose={() => setShowSettings(false)}
          settings={settings}
          onUpdateSettings={setSettings}
        />
        
        <div className="text-center z-50 p-12 border-y border-red-900/30 bg-black/80 backdrop-blur-sm max-w-2xl w-full mx-4 relative">
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-red-900/50"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-red-900/50"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-red-900/50"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-red-900/50"></div>

          <h1 className="font-calligraphy text-7xl text-red-900 mb-8 drop-shadow-[0_0_15px_rgba(220,20,60,0.6)]">
            幽冥录
          </h1>
          <p className="mb-12 font-serif text-xl tracking-[0.3em] opacity-60 text-stone-300">
            佩戴耳机 · 关灯体验
            <span className="text-xs text-stone-600 mt-4 block tracking-normal opacity-50 font-sans">(Please enable audio)</span>
          </p>
          <button 
            onClick={startGame}
            className="px-12 py-4 border border-stone-800 hover:border-red-900 hover:text-red-600 transition-all duration-700 tracking-[0.8em] text-2xl group relative overflow-hidden bg-black"
          >
            <span className="relative z-10 pl-2">入局</span>
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
      <SettingsModal 
          show={showSettings} 
          onClose={() => setShowSettings(false)}
          settings={settings}
          onUpdateSettings={setSettings}
      />
      
      {/* Layer 0: Background Image */}
      <div className="fixed inset-0 bg-black z-0">
        <img 
          src={gameState.currentImage} 
          alt="Atmosphere" 
          className={`w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${gameState.imageLoading ? 'opacity-30' : 'opacity-50'}`}
        />
        <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
      </div>

      {/* Layer 1: The Darkness Mask */}
      <Atmosphere flashTrigger={flashTrigger} />

      {/* Layer 2: UI & Narrative */}
      <div className="relative z-30 flex h-full items-center justify-center pointer-events-none p-4 md:p-8">
        <div className="max-w-6xl w-full flex flex-col md:flex-row gap-8 md:gap-16 items-stretch justify-center h-auto min-h-[60vh]">
          
          {/* Text Area (Redesigned Layout) */}
          <div className="narrative-container w-full md:w-3/5 flex flex-col justify-center pointer-events-auto min-h-[400px]">
             
             {gameState.error ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 animate-pulse">
                  <p className="text-red-800 font-curse text-3xl text-center">{gameState.error}</p>
                  <button 
                    onClick={() => gameState.history.length > 0 ? handleChoice("尝试重新连接") : startGame()} 
                    className="border-b border-stone-700 hover:text-red-500 hover:border-red-500 transition-colors pb-1 text-lg"
                  >
                    重新凝视 (重试)
                  </button>
                </div>
             ) : gameState.loadingText ? (
               <div className="text-stone-700 animate-pulse text-center w-full flex items-center justify-center h-full">
                 <span className="font-calligraphy text-3xl opacity-50">... ... ...</span>
               </div>
             ) : (
               currentResponse && (
                 <Typewriter 
                   text={currentResponse.narrative} 
                   speed={40}
                   onComplete={onNarrativeComplete}
                 />
               )
             )}
          </div>

          {/* Action Area */}
          <div className="w-full md:w-2/5 flex flex-col gap-6 justify-center pointer-events-auto">
            {!gameState.loadingText && !gameState.error && currentResponse && !gameState.isGameOver && currentResponse.choices && (
               <div className="flex flex-col gap-5 w-full pl-4 border-l border-stone-900/30">
                  {currentResponse.choices?.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(choice)}
                      className="btn-gloom group relative px-6 py-5 border border-stone-900/50 bg-black/40 text-stone-400 text-lg font-serif text-left hover:border-red-900 transition-all duration-500 backdrop-blur-sm"
                    >
                       <span className="relative z-10 group-hover:pl-3 transition-all duration-500 block">{choice}</span>
                    </button>
                  ))}
               </div>
            )}

            {gameState.isGameOver && !gameState.loadingText && (
              <div className="flex items-center justify-center h-full">
                <button 
                    onClick={() => window.location.reload()}
                    className="text-red-800 border-b-2 border-red-900 pb-2 hover:text-red-600 hover:border-red-600 transition-colors font-calligraphy text-4xl tracking-widest"
                >
                    重新轮回
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Inventory Display Layer */}
      <InventoryDisplay />

    </div>
  );
};

export default App;