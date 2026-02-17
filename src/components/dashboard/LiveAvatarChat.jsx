import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Send, Loader2 } from 'lucide-react';

const LiveAvatarChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const [isMuted, setIsMuted] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState(null);
  const [captions, setCaptions] = useState('');
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const videoRef = useRef(null);
  const sessionObjRef = useRef(null);

  const startSession = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      // Get session token from our API
      const res = await fetch('/api/liveavatar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get session');

      // Import the SDK
      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = await import('@heygen/liveavatar-web-sdk');

      // Create session with the token
      const session = new LiveAvatarSession(data.session_token, {
        voiceChat: true,
      });
      sessionObjRef.current = session;

      // Listen for state changes
      session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
        console.log('[LiveAvatar] State:', state);
        if (state === 'DISCONNECTED') {
          setStatus('idle');
          setCaptions('');
          setIsAvatarTalking(false);
        }
      });

      // Listen for stream ready → set connected, attach in useEffect
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log('[LiveAvatar] Stream ready!');
        setStatus('connected');
      });

      // Listen for avatar speaking events for captions
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, (eventData) => {
        console.log('[LiveAvatar] Avatar speaking:', eventData);
        setIsAvatarTalking(true);
        if (eventData?.text) setCaptions(eventData.text);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        setIsAvatarTalking(false);
      });

      // Start the session
      await session.start();
      console.log('[LiveAvatar] Session started');

    } catch (err) {
      console.error('LiveAvatar error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, []);

  const endSession = useCallback(async () => {
    if (sessionObjRef.current) {
      try {
        await sessionObjRef.current.stop();
      } catch (e) { /* ignore */ }
      sessionObjRef.current = null;
    }
    setStatus('idle');
    setCaptions('');
    setIsAvatarTalking(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!sessionObjRef.current?.voiceChat) return;
    try {
      if (isMuted) {
        await sessionObjRef.current.voiceChat.unmute();
        setIsMuted(false);
      } else {
        await sessionObjRef.current.voiceChat.mute();
        setIsMuted(true);
      }
    } catch (err) {
      console.error('Mute toggle error:', err);
    }
  }, [isMuted]);

  const sendText = useCallback(async () => {
    if (!textInput.trim() || !sessionObjRef.current) return;
    const msg = textInput.trim();
    setTextInput('');

    try {
      // Use SDK's text chat
      if (sessionObjRef.current.sendMessage) {
        await sessionObjRef.current.sendMessage(msg);
      } else if (sessionObjRef.current.chat) {
        await sessionObjRef.current.chat(msg);
      } else {
        // Fallback: direct API call
        const token = sessionObjRef.current._accessToken || sessionObjRef.current.accessToken;
        if (token) {
          await fetch('https://api.liveavatar.com/v1/sessions/chat', {
            method: 'POST',
            headers: {
              'authorization': `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ text: msg }),
          });
        }
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  }, [textInput]);

  // Attach video when connected and video element is rendered
  useEffect(() => {
    if (status === 'connected' && videoRef.current && sessionObjRef.current) {
      console.log('[LiveAvatar] Attaching video element');
      sessionObjRef.current.attach(videoRef.current);
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (sessionObjRef.current) {
        try { sessionObjRef.current.stop(); } catch (e) { /* ignore */ }
      }
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
      {/* Floating Avatar Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleToggle}
            className="fixed bottom-6 right-6 z-50 group"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-40 blur-md group-hover:opacity-60 transition-opacity" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#0f1a2e] to-[#0b0f1a] border border-emerald-500/40 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all overflow-hidden flex items-center justify-center">
              <span className="text-emerald-300 text-xl font-semibold leading-none">S</span>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="absolute -top-8 right-0 px-3 py-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Chat with Sophia
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] rounded-2xl overflow-hidden border border-white/10 bg-[#080c14] shadow-2xl shadow-black/60"
          >
            {/* Close */}
            <button
              onClick={handleToggle}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/50 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Video */}
            <div className="relative aspect-[4/3] bg-black">
              {status === 'connected' ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Live badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 text-[10px] font-medium tracking-wider uppercase">Live</span>
                  </div>

                  {/* Captions */}
                  <AnimatePresence>
                    {captions && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-0 left-0 right-0 p-4"
                      >
                        <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 border border-white/5">
                          <p className="text-white text-sm leading-relaxed">
                            {captions}
                            {isAvatarTalking && (
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                                className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 align-middle"
                              />
                            )}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
                  {status === 'idle' && (
                    <>
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
                        <span className="text-emerald-300 text-2xl font-semibold leading-none">S</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium text-sm mb-1">Meet Sophia</p>
                        <p className="text-white/40 text-xs leading-relaxed">
                          Your AI trading assistant. Ask about strategies, features, or pricing.
                        </p>
                      </div>
                      <button
                        onClick={startSession}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Start Conversation
                      </button>
                    </>
                  )}
                  {status === 'connecting' && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-white/50 text-sm">Connecting to Sophia...</p>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                      <button
                        onClick={startSession}
                        className="px-5 py-2 rounded-xl border border-white/15 text-white/70 text-sm hover:bg-white/5 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            {status === 'connected' && (
              <div className="px-3 py-3 bg-[#080c14] border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      isMuted
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendText()}
                    placeholder="Ask Sophia anything..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/8 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-500/40 transition-colors"
                  />
                  <button
                    onClick={sendText}
                    disabled={!textInput.trim()}
                    className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center disabled:opacity-20 hover:bg-emerald-500/25 transition-colors"
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
