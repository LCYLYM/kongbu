
import React from 'react';
import { GameSettings, LLMProvider } from '../types';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = React.memo(({ show, onClose, settings, onUpdateSettings }) => {
  if (!show) return null;

  const handleProviderChange = (provider: LLMProvider) => {
    let newModel = settings.model;
    let newImageModel = settings.imageModel;

    if (provider === 'gemini') {
        if (settings.model.includes('gpt')) newModel = 'gemini-2.5-flash';
        if (!settings.imageModel || settings.imageModel.includes('gpt')) newImageModel = 'gemini-2.5-flash-image';
    } else if (provider === 'openai') {
        if (settings.model.includes('gemini')) newModel = 'gpt-4o';
        if (!settings.imageModel || settings.imageModel.includes('gemini')) newImageModel = 'gpt-4o-image';
    }
    
    onUpdateSettings({ ...settings, provider, model: newModel, imageModel: newImageModel });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md p-8 border border-red-900/50 bg-stone-950 text-stone-300 relative shadow-[0_0_30px_rgba(50,0,0,0.3)]">
        <h2 className="text-2xl font-calligraphy text-red-800 mb-6 border-b border-red-900/30 pb-2">天机设定 (Settings)</h2>
        
        <div className="space-y-6 font-serif">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm mb-3 text-stone-500 tracking-widest">服务商 (Provider)</label>
            <div className="flex gap-4">
              <button 
                onClick={() => handleProviderChange('gemini')}
                className={`flex-1 px-4 py-3 border transition-all duration-300 ${settings.provider === 'gemini' ? 'border-red-800 text-red-500 bg-red-950/20 shadow-[0_0_10px_rgba(120,0,0,0.2)]' : 'border-stone-800 text-stone-600 hover:border-stone-600'}`}
              >
                Gemini
              </button>
              <button 
                onClick={() => handleProviderChange('openai')}
                className={`flex-1 px-4 py-3 border transition-all duration-300 ${settings.provider === 'openai' ? 'border-red-800 text-red-500 bg-red-950/20 shadow-[0_0_10px_rgba(120,0,0,0.2)]' : 'border-stone-800 text-stone-600 hover:border-stone-600'}`}
              >
                OpenAI
              </button>
            </div>
          </div>

          {/* Text Model Input */}
          <div>
            <label className="block text-sm mb-2 text-stone-500 tracking-widest">文字模型 (Text Model)</label>
            <input 
              type="text"
              value={settings.model}
              onChange={(e) => onUpdateSettings({ ...settings, model: e.target.value })}
              placeholder={settings.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-4o"}
              className="w-full bg-black border border-stone-800 p-3 focus:border-red-900 focus:shadow-[0_0_10px_rgba(100,0,0,0.3)] outline-none text-stone-300 font-mono text-sm transition-all"
            />
          </div>

          {/* Image Model Input */}
          <div>
            <label className="block text-sm mb-2 text-stone-500 tracking-widest">绘图模型 (Image Model)</label>
            <input 
              type="text"
              value={settings.imageModel}
              onChange={(e) => onUpdateSettings({ ...settings, imageModel: e.target.value })}
              placeholder={settings.provider === 'gemini' ? "gemini-2.5-flash-image" : "gpt-4o-image (chat mode)"}
              className="w-full bg-black border border-stone-800 p-3 focus:border-red-900 focus:shadow-[0_0_10px_rgba(100,0,0,0.3)] outline-none text-stone-300 font-mono text-sm transition-all"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm mb-2 text-stone-500 tracking-widest">API Key {settings.provider === 'gemini' && '(Optional)'}</label>
            <input 
              type="password"
              value={settings.apiKey || ''}
              onChange={(e) => onUpdateSettings({ ...settings, apiKey: e.target.value })}
              placeholder={settings.provider === 'gemini' ? "使用系统环境变量或输入..." : "sk-..."}
              className="w-full bg-black border border-stone-800 p-3 focus:border-red-900 focus:shadow-[0_0_10px_rgba(100,0,0,0.3)] outline-none text-stone-300 placeholder-stone-800 font-mono text-sm transition-all"
            />
          </div>
           
           {/* Base URL (Available for both now) */}
            <div>
              <label className="block text-sm mb-2 text-stone-500 tracking-widest">Base URL (Optional)</label>
              <input 
                type="text"
                value={settings.baseUrl || ''}
                onChange={(e) => onUpdateSettings({ ...settings, baseUrl: e.target.value })}
                placeholder={settings.provider === 'gemini' ? "https://generativelanguage.googleapis.com" : "https://api.openai.com/v1"}
                className="w-full bg-black border border-stone-800 p-3 focus:border-red-900 focus:shadow-[0_0_10px_rgba(100,0,0,0.3)] outline-none text-stone-300 placeholder-stone-800 font-mono text-sm transition-all"
              />
            </div>
        </div>

        <div className="mt-10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-2 border border-stone-800 hover:border-red-800 hover:text-red-500 hover:bg-red-950/10 transition-all duration-500 text-stone-400"
          >
            [ 完成设定 ]
          </button>
        </div>
      </div>
    </div>
  );
});
