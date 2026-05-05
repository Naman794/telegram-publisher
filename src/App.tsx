import React, { useState, useEffect, useRef } from 'react';
import { Bold, Italic, Link2, Image as ImageIcon } from 'lucide-react';
import { sendTelegramMessage } from './lib/telegram';
import { TelegramConfig, HistoryItem } from './types';

export default function App() {
  const [config, setConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('telepost_config');
    return saved ? JSON.parse(saved) : { botToken: '', channelId: '' };
  });

  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState<{message: string, type: 'error' | 'success' | 'info'} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('telepost_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Save config to local storage when it changes
  useEffect(() => {
    localStorage.setItem('telepost_config', JSON.stringify(config));
  }, [config]);

  // Save history to local storage when it changes
  useEffect(() => {
    localStorage.setItem('telepost_history', JSON.stringify(history));
  }, [history]);

// Removed frontend setInterval checking for scheduled posts


  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 5000);
  };

  const createThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 100;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePost = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (!config.botToken || !config.channelId) {
      showToast('Please set your Bot Token and Channel ID first.');
      return;
    }
    if (!message.trim() && !imageFile) {
      showToast('Message content or an image is required.');
      return;
    }

    setIsPosting(true);
    setUploadProgress(0);
    let thumbUrl = '';
    if (imageFile) {
      thumbUrl = await createThumbnail(imageFile);
    }

    const newHistoryItem: HistoryItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      text: message,
      imageUrl: thumbUrl,
      status: 'success',
      timestamp: Date.now(),
      channelId: config.channelId,
    };

    try {
      await sendTelegramMessage(config.botToken, config.channelId, message, imageFile, (progress) => {
        setUploadProgress(progress);
      });
      setMessage('');
      setImageFile(null);
      setImagePreviewUrl('');
    } catch (error) {
      newHistoryItem.status = 'error';
      newHistoryItem.errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    } finally {
      setIsPosting(false);
      setHistory((prev) => [newHistoryItem, ...prev]);
    }
  };

  const clearHistory = () => {
    // Replaced confirm() with direct action, or you can implement a custom modal
    setHistory([]);
    showToast('History cleared', 'success');
  };

  const insertFormatting = (tag: 'b' | 'i' | 'a') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText = '';

    if (tag === 'b') {
      newText = `<b>${selectedText}</b>`;
    } else if (tag === 'i') {
      newText = `<i>${selectedText}</i>`;
    } else if (tag === 'a') {
      // Replaced prompt because it causes iframe issues
      newText = `<a href="https://example.com">${selectedText || 'Link text'}</a>`;
      showToast('Link placeholder inserted. Please replace example.com with your URL', 'info');
    }

    const beforeText = message.substring(0, start);
    const afterText = message.substring(end, message.length);
    const updatedMessage = beforeText + newText + afterText;
    
    setMessage(updatedMessage);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="min-h-screen h-[100dvh] bg-white text-gray-900 font-sans flex flex-col overflow-hidden relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg text-sm font-bold text-white transition-opacity ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-gray-900 flex items-center justify-between px-4 md:px-8 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white transform rotate-45"></div>
          </div>
          <h1 className="text-lg font-bold tracking-tighter uppercase hidden sm:block">Telegram Dispatcher</h1>
          <h1 className="text-lg font-bold tracking-tighter uppercase sm:hidden">Dispatcher</h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${config.botToken && config.channelId ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 hidden sm:inline">
              {config.botToken && config.channelId ? 'API Connected' : 'Unconfigured'}
            </span>
          </div>
          <div className="w-10 h-10 border border-gray-900 flex items-center justify-center font-mono text-sm shrink-0">JD</div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
        
        {/* Composer Panel */}
        <section className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-900 flex flex-col p-4 xl:p-8 bg-gray-50 lg:overflow-y-auto lg:min-h-0 shrink-0 relative">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-1 text-blue-600">Post Configuration</h2>
            <p className="text-sm text-gray-500">Prepare your message for broadcast</p>
          </div>

          <div className="space-y-5 sm:space-y-6 flex-1 flex flex-col">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bot API Token</label>
              <input
                type="password"
                value={config.botToken}
                onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                placeholder="1234567890:ABCdefGHIjkl..."
                className="bg-white border border-gray-900 px-4 py-3 font-mono text-sm focus:ring-0 focus:border-blue-600 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Channel ID / @Username</label>
              <input
                type="text"
                value={config.channelId}
                onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                placeholder="@tech_updates_daily"
                className="bg-white border border-gray-900 px-4 py-3 text-sm focus:ring-0 focus:border-blue-600 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2 flex-1 relative">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Message Content</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => insertFormatting('b')} className="p-1 hover:bg-gray-200 text-gray-600 rounded transition" title="Bold">
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => insertFormatting('i')} className="p-1 hover:bg-gray-200 text-gray-600 rounded transition" title="Italic">
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => insertFormatting('a')} className="p-1 hover:bg-gray-200 text-gray-600 rounded transition" title="Link">
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-white border border-gray-900 px-4 py-3 text-sm h-40 sm:h-48 lg:flex-1 resize-none focus:ring-0 focus:border-blue-600 outline-none"
                placeholder="Type your channel update here... (HTML supported)"
              ></textarea>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Image Upload (Optional)</label>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreviewUrl(URL.createObjectURL(file));
                  } else {
                    setImageFile(null);
                    setImagePreviewUrl('');
                  }
                }}
                className="bg-white border text-gray-700 border-gray-900 px-3 py-2 text-sm focus:ring-0 focus:border-blue-600 outline-none file:mr-4 file:py-1.5 file:px-3 file:border-0 file:text-[10px] file:uppercase file:tracking-wider file:font-bold file:bg-gray-900 file:text-white hover:file:bg-gray-800 transition-colors file:cursor-pointer"
              />
              {imagePreviewUrl && (
                <div className="mt-2 relative inline-block w-20 h-20 border border-gray-200 rounded">
                  <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover rounded" />
                  <button 
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreviewUrl(''); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
                    title="Remove Image"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 sm:mt-8">
              <button
                type="button"
                onClick={handlePost}
                disabled={isPosting || (!message.trim() && !imageFile)}
                className="w-full bg-gray-900 text-white font-bold uppercase tracking-widest py-4 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {isPosting && imageFile && uploadProgress > 0 && uploadProgress < 100 && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-blue-600/50 transition-all duration-300 pointer-events-none" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                )}
                
                <span className="relative z-10 flex items-center gap-2">
                  {isPosting 
                    ? (imageFile && uploadProgress > 0 && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Dispatching...') 
                    : 'Dispatch to Channel'
                  }
                  {!isPosting && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  )}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Preview Panel */}
        <section className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-900 flex flex-col bg-gray-100 lg:overflow-y-auto min-h-[400px] lg:min-h-0 shrink-0 relative w-full">
          <div className="h-16 border-b border-gray-900 flex items-center px-4 xl:px-8 bg-white shrink-0 sticky top-0 z-10 w-full">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-1">Live Preview</h2>
              <span className="text-[9px] text-gray-400 font-mono tracking-widest">REAL-TIME RENDERING</span>
            </div>
          </div>
          
          <div className="flex-1 p-4 xl:p-6 bg-[#ebf0f5] relative flex flex-col w-full min-h-[300px]">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '16px 16px'}}></div>
            
            {(message || imagePreviewUrl) ? (
              <div className="flex gap-2.5 max-w-full">
                {/* Avatar Placeholder */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shrink-0 mt-auto flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {config.channelId ? config.channelId.replace('@', '').substring(0, 2).toUpperCase() : 'CH'}
                </div>

                {/* Message Bubble */}
                <div className="relative flex-1 max-w-[85%] sm:max-w-[300px] self-end bg-white rounded-2xl rounded-bl-none shadow-sm border border-black/5 flex flex-col overflow-hidden">
                  {imagePreviewUrl && (
                    <div className="w-full bg-black/5">
                      <img src={imagePreviewUrl} alt="Preview" className="w-full h-auto max-h-64 object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="p-3 pb-2 flex flex-col">
                    <div className="text-[13px] font-bold text-[#3390ec] mb-0.5">
                      {config.channelId || 'Your Channel'}
                    </div>
                    {message && (
                      <div 
                        className="text-[14px] leading-[1.4] text-gray-900 break-words font-sans whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: message }}
                      />
                    )}
                    <div className="text-[11px] text-right text-gray-400 mt-1.5 self-end flex items-center gap-1">
                      {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="m-auto text-center p-6 border-2 border-dashed border-gray-300 rounded-lg max-w-[80%] opacity-50 bg-white/50">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Add text or an image to see preview</p>
              </div>
            )}
          </div>
        </section>

        {/* History Panel */}
        <section className="lg:col-span-4 flex flex-col bg-white lg:overflow-y-auto min-h-[500px] lg:min-h-0 shrink-0 relative w-full">
          <div className="h-16 sm:h-20 border-b border-gray-900 flex items-center justify-between px-4 xl:px-8 bg-white shrink-0 sticky top-0 z-10 w-full">
            <div>
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1">Broadcast History</h2>
              <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono">DISPLAYING LAST {history.length} TRANSACTIONS</span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="hidden sm:block px-3 py-1 border border-gray-900 text-[10px] font-bold uppercase hover:bg-gray-50 transition-colors">Export CSV</button>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="px-3 py-1 border border-gray-900 text-[10px] font-bold uppercase hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50 lg:bg-white">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="bg-white border-b border-gray-900 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 sm:px-8 py-3 sm:py-4 text-[10px] font-bold uppercase tracking-widest border-r border-gray-900">Timestamp</th>
                  <th className="px-4 sm:px-8 py-3 sm:py-4 text-[10px] font-bold uppercase tracking-widest border-r border-gray-900">Channel</th>
                  <th className="px-4 sm:px-8 xl:px-4 py-3 sm:py-4 text-[10px] font-bold uppercase tracking-widest border-r border-gray-900 w-1/4">Status</th>
                  <th className="px-4 sm:px-8 xl:px-4 py-3 sm:py-4 text-[10px] font-bold uppercase tracking-widest">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center text-gray-400 text-xs font-mono uppercase tracking-widest">
                      No Records
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-mono text-[11px] border-r border-gray-100 whitespace-nowrap">{formatDate(item.timestamp)}</td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4 text-xs font-medium border-r border-gray-100 whitespace-nowrap">{item.channelId}</td>
                      <td className="px-4 sm:px-8 xl:px-4 py-3 sm:py-4 border-r border-gray-100 whitespace-nowrap">
                        {item.status === 'success' ? (
                          <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">Deliv'd</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter" title={item.errorMessage}>Fail</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-8 xl:px-4 py-3 sm:py-4 text-xs text-gray-500 max-w-[120px] sm:max-w-[200px] md:max-w-[150px]">
                        {item.imageUrl && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <img src={item.imageUrl} alt="thumbnail" referrerPolicy="no-referrer" className="w-6 h-6 object-cover rounded shadow-sm border border-gray-200 shrink-0" />
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 truncate">
                              <ImageIcon className="w-3 h-3 shrink-0" /> <span className="truncate">IMAGE INCLUDED</span>
                            </span>
                          </div>
                        )}
                        <div className="truncate">{item.text || <span className="italic text-gray-400">No text content</span>}</div>
                        {item.status === 'error' && (
                          <div className="text-[10px] text-red-500 font-mono mt-0.5 truncate">{item.errorMessage}</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="h-12 border-t border-gray-900 bg-gray-50 px-4 xl:px-8 flex items-center justify-between shrink-0 hidden lg:flex mt-auto">
            <div className="flex gap-4">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">System v1.0.0</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Grid Align: Active</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-blue-600 underline cursor-pointer hover:text-gray-900">View Documentation</div>
          </footer>
        </section>
      </main>
    </div>
  );
}
