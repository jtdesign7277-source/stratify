import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Mic, MicOff, Send, Loader2 } from 'lucide-react';

const LiveAvatarChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [isMuted, setIsMuted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const pcRef = useRef(null);

  const startSession = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      // Get session token from our API
      const tokenRes = await fetch('/api/liveavatar-token', { method: 'POST' });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Failed to get session token');
      }

      sessionRef.current = tokenData;

      // Start the session
      const startRes = await fetch('https://api.liveavatar.com/v1/sessions/start', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${tokenData.session_token}`,
        },
      });

      const startData = await startRes.json();

      if (!startRes.ok) {
        throw new Error(startData.message || 'Failed to start session');
      }

      // Connect via LiveKit WebRTC
      const { livekit_url, livekit_client_token } = startData.data || startData;

      if (livekit_url && livekit_client_token) {
        // Dynamic import of LiveKit client
        const { Room, RoomEvent, Track } = await import('livekit-client');
        
        const room = new Room();
        pcRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          }
          if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach();
            document.body.appendChild(audioEl);
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          setStatus('idle');
        });

        await room.connect(livekit_url, livekit_client_token);
        
        // Enable microphone
        await room.localParticipant.setMicrophoneEnabled(true);
        
        setStatus('connected');
        setMessages(prev => [...prev, {
          role: 'avatar',
          text: "Hi! I'm here to help you learn about Stratify. Ask me anything about our AI-powered trading platform!",
        }]);
      }
    } catch (err) {
      console.error('LiveAvatar error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, []);

  const endSession = useCallback(async () => {
    if (pcRef.current) {
      await pcRef.current.disconnect();
      pcRef.current = null;
    }
    sessionRef.current = null;
    setStatus('idle');
    setMessages([]);
  }, []);

  const toggleMute = useCallback(async () => {
    if (pcRef.current) {
      await pcRef.current.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const sendText = useCallback(async () => {
    if (!textInput.trim() || !sessionRef.current) return;

    const msg = textInput.trim();
    setTextInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);

    try {
      await fetch('https://api.liveavatar.com/v1/sessions/chat', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${sessionRef.current.session_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: msg }),
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  }, [textInput]);

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.disconnect();
    };
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      endSession();
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-shadow flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0b] shadow-2xl shadow-black/50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div>
                  <div className="text-white text-sm font-medium">Stratify Assistant</div>
                  <div className="text-emerald-400 text-xs flex items-center gap-1">
                    {status === 'connected' && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </>
                    )}
                    {status === 'connecting' && 'Connecting...'}
                    {status === 'idle' && 'Click Start to chat'}
                    {status === 'error' && <span className="text-red-400">Connection failed</span>}
                  </div>
                </div>
              </div>
              <button onClick={handleToggle} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Area */}
            <div className="relative flex-1 bg-black">
              {status === 'connected' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                  {status === 'idle' && (
                    <>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-emerald-400" />
                      </div>
                      <p className="text-white/60 text-sm text-center">
                        Chat with our AI assistant about Stratify's features, pricing, and trading strategies
                      </p>
                      <button
                        onClick={startSession}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/25"
                      >
                        Start Conversation
                      </button>
                    </>
                  )}
                  {status === 'connecting' && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-white/60 text-sm">Connecting to avatar...</p>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex flex-col items-center gap-3 px-4">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                      <button
                        onClick={startSession}
                        className="px-6 py-2 rounded-xl border border-white/20 text-white/80 text-sm hover:bg-white/5 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            {status === 'connected' && (
              <div className="px-3 py-3 border-t border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendText()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    onClick={sendText}
                    disabled={!textInput.trim()}
                    className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center disabled:opacity-30 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveAvatarChat;
