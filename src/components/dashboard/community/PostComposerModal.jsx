import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, TrendingUp, ArrowLeftRight, Brain, Bell, BarChart3, Globe, MessageCircle,
  Camera, SmilePlus, Wand2, Send, Loader2,
} from 'lucide-react';
import EmojiPicker from '../EmojiPicker';
import {
  T,
  SLIP_EMOJI_PRESETS,
  AI_REWRITE_STYLE_OPTIONS,
  AI_REWRITE_PERSONALITY_OPTIONS,
  AI_REWRITE_ACTION_ROW_VARIANTS,
  AI_REWRITE_ACTION_ITEM_VARIANTS,
  FEED_HASHTAGS,
  MODAL_BACKDROP_TRANSITION,
  MODAL_PANEL_ENTER_TRANSITION,
  MODAL_PANEL_EXIT_TRANSITION,
  OVERLAY_PANEL_TRANSITION,
  DEFAULT_TICKERS,
} from './communityConstants';
import {
  sanitizePostType,
  createSlipCaption,
  formatSignedPercent,
  formatSignedCurrency,
  buildCurrentUserAvatarUrl,
  escapeRegExp,
} from './communityHelpers';
import { modalSectionMotion } from './communityConstants';
import { UserAvatar, ComposerTypePill } from './CommunityShared';

const PostComposerModal = ({
  open,
  onClose,
  currentUser,
  currentUserAvatarUrl,
  displayName,
  closedTrades = [],
  submitting = false,
  initialPostType = 'general',
  prefilledText = '',
  openAiRewritePanelOnOpen = false,
  onConsumePrefilledText,
  onSubmit,
}) => {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [selectedSlipEmojis, setSelectedSlipEmojis] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAiRewritePanel, setShowAiRewritePanel] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedPersonality, setSelectedPersonality] = useState(null);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [isAiRewriteLoading, setIsAiRewriteLoading] = useState(false);
  const [aiRewriteError, setAiRewriteError] = useState('');
  const [originalDraft, setOriginalDraft] = useState('');
  const [hasAiRewriteResult, setHasAiRewriteResult] = useState(false);
  const [lastAiRewriteConfig, setLastAiRewriteConfig] = useState({ styleId: '', personalityId: '' });
  const [rewriteResultVersion, setRewriteResultVersion] = useState(0);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const hasInitializedOnOpenRef = useRef(false);

  const resetAiRewriteSelections = useCallback(() => {
    setSelectedStyle(null);
    setSelectedPersonality(null);
    setSelectedHashtags([]);
  }, []);

  const closeAiRewritePanel = useCallback(() => {
    setShowAiRewritePanel(false);
    resetAiRewriteSelections();
  }, [resetAiRewriteSelections]);

  const closeComposerModal = useCallback(() => {
    setShowAiRewritePanel(false);
    resetAiRewriteSelections();
    onClose?.();
  }, [onClose, resetAiRewriteSelections]);

  useEffect(() => {
    if (!open) {
      hasInitializedOnOpenRef.current = false;
      setShowAiRewritePanel(false);
      resetAiRewriteSelections();
      return;
    }
    if (hasInitializedOnOpenRef.current) return;
    hasInitializedOnOpenRef.current = true;

    const draftPrefill = String(prefilledText || '');
    const hasDraftPrefill = Boolean(draftPrefill.trim());

    setPostType(sanitizePostType(initialPostType));
    setSelectedTradeId(closedTrades[0]?.id || '');
    setSelectedSlipEmojis([]);
    setContent(hasDraftPrefill ? draftPrefill : '');
    setImageFile(null);
    setImagePreview('');
    setShowEmojiPicker(false);
    setShowAiRewritePanel(hasDraftPrefill && openAiRewritePanelOnOpen);
    resetAiRewriteSelections();
    setIsAiRewriteLoading(false);
    setAiRewriteError('');
    setOriginalDraft(hasDraftPrefill ? draftPrefill : '');
    setHasAiRewriteResult(false);
    setLastAiRewriteConfig({ styleId: '', personalityId: '' });
    setRewriteResultVersion(0);
    if (fileRef.current) fileRef.current.value = '';
    if (hasDraftPrefill) onConsumePrefilledText?.();
  }, [open, initialPostType, closedTrades, prefilledText, openAiRewritePanelOnOpen, onConsumePrefilledText, resetAiRewriteSelections]);

  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => {
      try { URL.revokeObjectURL(imagePreview); } catch {}
    };
  }, [imagePreview]);

  const selectedTrade = useMemo(
    () => closedTrades.find((trade) => String(trade.id) === String(selectedTradeId)) || null,
    [closedTrades, selectedTradeId],
  );

  const composerDisplayName = String(displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Guest Trader').trim() || 'Guest Trader';
  const composerAvatarUrl = String(currentUserAvatarUrl || currentUser?.avatar_url || buildCurrentUserAvatarUrl(composerDisplayName)).trim();
  const canAutofillSlip = postType === 'pnl' && selectedTrade;
  const hasComposerText = Boolean(content.trim());
  const hasAiRewriteSelection = Boolean(selectedStyle || selectedPersonality);
  const canOpenAiRewrite = !isAiRewriteLoading;
  const canRunAiRewrite = hasComposerText && !isAiRewriteLoading;
  const canRetryAiRewrite = Boolean(!isAiRewriteLoading && (lastAiRewriteConfig.styleId || lastAiRewriteConfig.personalityId) && (originalDraft || content.trim()));

  const toggleSlipEmoji = (emoji) => {
    setSelectedSlipEmojis((prev) => (
      prev.includes(emoji) ? prev.filter((value) => value !== emoji) : [...prev, emoji]
    ));
  };

  const addHashtagToContent = useCallback((value, hashtag) => {
    const safeValue = String(value || '');
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return safeValue;
    const hashtagPattern = new RegExp(`(^|\\s)${escapeRegExp(safeHashtag)}(?=\\s|$)`);
    if (hashtagPattern.test(safeValue)) return safeValue;
    const withSpace = safeValue && !/\s$/.test(safeValue) ? `${safeValue} ` : safeValue;
    return `${withSpace}${safeHashtag}`;
  }, []);

  const removeHashtagFromContent = useCallback((value, hashtag) => {
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return String(value || '');
    const escaped = escapeRegExp(safeHashtag);
    return String(value || '')
      .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .trim();
  }, []);

  const toggleRewriteHashtag = useCallback((hashtag) => {
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return;
    setSelectedHashtags((prev) => {
      const isActive = prev.includes(safeHashtag);
      setContent((currentValue) => (
        isActive ? removeHashtagFromContent(currentValue, safeHashtag) : addHashtagToContent(currentValue, safeHashtag)
      ));
      return isActive ? prev.filter((tag) => tag !== safeHashtag) : [...prev, safeHashtag];
    });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [addHashtagToContent, removeHashtagFromContent]);

  const autofillFromTrade = () => {
    if (!selectedTrade) return;
    setContent(createSlipCaption({ trade: selectedTrade, emojis: selectedSlipEmojis }));
  };

  const handleSelectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { window.alert('Image must be 5MB or smaller.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch {} }
    setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const runAiRewrite = async ({
    sourceText = content,
    styleId = selectedStyle,
    personalityId = selectedPersonality,
    hashtags = selectedHashtags,
    preserveOriginal = false,
  } = {}) => {
    const textValue = String(sourceText || '').trim();
    if (!textValue) return;

    const baseOriginal = String(preserveOriginal ? (originalDraft || textValue) : textValue).trim();
    if (!preserveOriginal || !originalDraft) setOriginalDraft(baseOriginal);

    setAiRewriteError('');
    setIsAiRewriteLoading(true);
    setHasAiRewriteResult(false);

    try {
      const response = await fetch('/api/community/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textValue,
          style: styleId || 'default',
          personality: personalityId || 'default',
          hashtags: Array.isArray(hashtags) ? hashtags : [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || 'AI rewrite failed'));

      const rewritten = String(payload?.rewritten || '').trim();
      if (!rewritten) throw new Error('AI rewrite returned empty content.');

      setContent(rewritten);
      setLastAiRewriteConfig({ styleId: styleId || 'default', personalityId: personalityId || 'default' });
      setHasAiRewriteResult(true);
      setRewriteResultVersion((version) => version + 1);
    } catch (error) {
      setAiRewriteError(String(error?.message || 'AI rewrite failed. Try again.'));
      setHasAiRewriteResult(false);
    } finally {
      setIsAiRewriteLoading(false);
    }
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !imageFile && !(postType === 'pnl' && selectedTrade)) return;

    const metadata = {};
    let finalContent = trimmed;

    if (postType === 'pnl' && selectedTrade) {
      metadata.ticker = selectedTrade.symbol;
      metadata.pnl = Number(selectedTrade.pnl.toFixed(2));
      metadata.percent = Number(selectedTrade.percent.toFixed(2));
      metadata.shares = Number(selectedTrade.shares.toFixed(4));
      metadata.entry_price = Number(selectedTrade.entryPrice.toFixed(4));
      metadata.exit_price = Number(selectedTrade.exitPrice.toFixed(4));
      metadata.opened_at = new Date(selectedTrade.openedAt).toISOString();
      metadata.closed_at = new Date(selectedTrade.closedAt).toISOString();
      metadata.emoji = selectedSlipEmojis;
      if (!finalContent) finalContent = createSlipCaption({ trade: selectedTrade, emojis: selectedSlipEmojis });
    }

    const ok = await onSubmit?.({ content: finalContent, postType, metadata, imageFile });
    if (ok !== false) closeComposerModal();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-2 sm:p-4">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: MODAL_BACKDROP_TRANSITION }}
            exit={{ opacity: 0, transition: { ...MODAL_BACKDROP_TRANSITION, delay: 0.15 } }}
            onClick={closeComposerModal}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10, transition: MODAL_PANEL_EXIT_TRANSITION }}
            transition={MODAL_PANEL_ENTER_TRANSITION}
            className="relative z-[60] w-full max-w-2xl rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden"
            style={{ borderColor: T.border, background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)' }}
          >
            <motion.div {...modalSectionMotion(0)} className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-[#7d8590]">Community Composer</div>
                <h3 className="text-lg font-semibold text-[#e6edf3]">Create Post</h3>
              </div>
              <button type="button" onClick={closeComposerModal} className="h-8 w-8 inline-flex items-center justify-center" style={{ color: T.text }}>
                <X size={14} strokeWidth={1.5} className="h-4 w-4" />
              </button>
            </motion.div>

            <div className="p-4 space-y-3">
              <motion.div {...modalSectionMotion(1)} className="flex flex-wrap gap-2">
                <ComposerTypePill active={postType === 'general'} icon={MessageCircle} label="General" onClick={() => setPostType('general')} accent={T.blue} />
                <ComposerTypePill active={postType === 'trade'} icon={ArrowLeftRight} label="Trade" onClick={() => setPostType('trade')} accent={T.blue} />
                <ComposerTypePill active={postType === 'strategy'} icon={Brain} label="Strategy" onClick={() => setPostType('strategy')} accent="#c297ff" />
                <ComposerTypePill active={postType === 'alert'} icon={Bell} label="Alert" onClick={() => setPostType('alert')} accent="#f0883e" />
                <ComposerTypePill active={postType === 'pnl'} icon={TrendingUp} label="P&L" onClick={() => setPostType('pnl')} accent={T.green} />
                <ComposerTypePill active={postType === 'earnings'} icon={BarChart3} label="Earnings" onClick={() => setPostType('earnings')} accent="#d29922" />
                <ComposerTypePill active={postType === 'macro'} icon={Globe} label="Macro" onClick={() => setPostType('macro')} accent="#58a6ff" />
              </motion.div>

              {postType === 'pnl' && (
                <motion.div {...modalSectionMotion(2)} className="rounded-xl border p-3 space-y-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] uppercase tracking-[0.14em]" style={{ color: T.text }}>Closed Trade</label>
                      <select
                        value={selectedTradeId}
                        onChange={(event) => setSelectedTradeId(event.target.value)}
                        className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm bg-transparent outline-none"
                        style={{ borderColor: T.border, color: T.text }}
                      >
                        {closedTrades.length === 0 ? (
                          <option value="">No completed trades available</option>
                        ) : (
                          closedTrades.slice(0, 80).map((trade) => (
                            <option key={trade.id} value={trade.id}>
                              {trade.symbol} {formatSignedPercent(trade.percent)} {formatSignedCurrency(trade.pnl)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={autofillFromTrade}
                      disabled={!canAutofillSlip}
                      className="sm:self-end h-9 px-3 rounded-lg border text-xs font-medium disabled:opacity-45"
                      style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                    >
                      Autofill Slip
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: T.text }}>Slip Emojis</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SLIP_EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleSlipEmoji(emoji)}
                          className="h-8 w-8 rounded-lg border text-sm"
                          style={{
                            borderColor: selectedSlipEmojis.includes(emoji) ? T.blue : T.border,
                            backgroundColor: selectedSlipEmojis.includes(emoji) ? 'rgba(88,166,255,0.15)' : 'rgba(13,17,23,0.8)',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div {...modalSectionMotion(3)} className="relative">
                <motion.div
                  key={`composer-rewrite-result-${rewriteResultVersion}`}
                  initial={rewriteResultVersion > 0 ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Share your setup, thesis, or execution notes..."
                    rows={6}
                    disabled={isAiRewriteLoading}
                    className="w-full rounded-xl border px-3 py-2.5 resize-none outline-none text-sm leading-6 placeholder:text-[#7d8590] disabled:opacity-100"
                    style={{
                      borderColor: T.border,
                      backgroundColor: 'rgba(13,17,23,0.66)',
                      color: isAiRewriteLoading ? 'transparent' : T.text,
                      caretColor: isAiRewriteLoading ? 'transparent' : T.text,
                    }}
                  />

                  <AnimatePresence initial={false}>
                    {isAiRewriteLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none rounded-xl px-3 py-3"
                      >
                        <div className="space-y-2.5">
                          {['92%', '78%', '66%'].map((width, index) => (
                            <div
                              key={`rewrite-loading-line-${index}`}
                              className="relative h-[10px] overflow-hidden rounded-md animate-pulse"
                              style={{ width, backgroundColor: 'rgba(255,255,255,0.05)' }}
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 1.2s linear infinite',
                                  animationDelay: `${index * 0.12}s`,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5"
                      style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                    >
                      <Camera size={13} />
                      Add Image
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((openState) => !openState)}
                        className="h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5"
                        style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                      >
                        <SmilePlus size={13} />
                        Emoji
                      </button>
                      <AnimatePresence initial={false}>
                        {showEmojiPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={OVERLAY_PANEL_TRANSITION}
                          >
                            <EmojiPicker
                              align="left"
                              onClose={() => setShowEmojiPicker(false)}
                              onSelect={(emoji) => { setContent((prev) => `${prev}${emoji}`); setShowEmojiPicker(false); }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={() => { if (!canOpenAiRewrite) return; setAiRewriteError(''); setShowAiRewritePanel(true); }}
                      disabled={!canOpenAiRewrite}
                      className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-white/20 text-white font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(102,126,234,0.5),0_0_40px_rgba(245,87,108,0.3),0_0_60px_rgba(79,172,254,0.2)] transition-all duration-300 ${canOpenAiRewrite ? 'hover:shadow-[0_0_30px_rgba(102,126,234,0.7),0_0_50px_rgba(245,87,108,0.4)] hover:scale-110 hover:brightness-110' : 'opacity-45 cursor-not-allowed'}`}
                      style={{ background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #667eea)', backgroundSize: '400% 400%', animation: 'premiumShimmer 6s ease infinite' }}
                    >
                      <Wand2 strokeWidth={2} className="w-4 h-4 text-white" />
                      <span className="text-white">AI Rewrite</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {DEFAULT_TICKERS.slice(0, 5).map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => setContent((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '} $${ticker}`.trimStart())}
                        className="h-7 px-2 rounded-full border text-[11px]"
                        style={{ borderColor: T.border, color: T.blue, backgroundColor: 'rgba(88,166,255,0.08)' }}
                      >
                        ${ticker}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {showAiRewritePanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="mt-2 overflow-hidden"
                    >
                      <div className="relative bg-[#151b23] border border-white/6 rounded-xl p-3">
                        <button
                          type="button"
                          onClick={closeAiRewritePanel}
                          className="absolute top-2 right-2 inline-flex items-center justify-center text-[#e6edf3] hover:text-[#e6edf3] transition-colors"
                          aria-label="Close AI rewrite panel"
                        >
                          <X size={13} strokeWidth={1.5} />
                        </button>

                        <div className="text-xs text-[#e6edf3] mb-2">Choose a vibe:</div>

                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Hashtags:</div>
                            <div className="flex flex-wrap gap-2">
                              {FEED_HASHTAGS.map((hashtag) => {
                                const selected = selectedHashtags.includes(hashtag);
                                return (
                                  <button
                                    key={`rewrite-hashtag-${hashtag}`}
                                    type="button"
                                    onClick={() => toggleRewriteHashtag(hashtag)}
                                    className={`rounded-full px-3 py-1 text-xs cursor-pointer border hover:bg-white/10 transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border-[#58a6ff]/40 text-[#58a6ff]' : 'bg-white/5 border-white/10 text-[#e6edf3]'}`}
                                  >
                                    {hashtag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Style:</div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {AI_REWRITE_STYLE_OPTIONS.map((option) => {
                                const selected = selectedStyle === option.id;
                                return (
                                  <button
                                    key={`rewrite-style-${option.id}`}
                                    type="button"
                                    onClick={() => setSelectedStyle(selectedStyle === option.id ? null : option.id)}
                                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border border-[#58a6ff]/40 text-[#58a6ff] font-medium' : 'bg-white/5 border border-white/10 text-[#e6edf3] hover:bg-white/8 hover:border-white/15 cursor-pointer'}`}
                                    title={`${option.label} - ${option.prompt}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Personality:</div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {AI_REWRITE_PERSONALITY_OPTIONS.map((option) => {
                                const selected = selectedPersonality === option.id;
                                return (
                                  <button
                                    key={`rewrite-personality-${option.id}`}
                                    type="button"
                                    onClick={() => setSelectedPersonality(selectedPersonality === option.id ? null : option.id)}
                                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border border-[#58a6ff]/40 text-[#58a6ff] font-medium' : 'bg-white/5 border border-white/10 text-[#e6edf3] hover:bg-white/8 hover:border-white/15 cursor-pointer'}`}
                                    title={`${option.label} - ${option.prompt}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void runAiRewrite()}
                          disabled={!canRunAiRewrite}
                          className={`mt-3 inline-flex items-center gap-1.5 bg-[#58a6ff] text-black font-medium text-xs px-4 py-1.5 rounded-lg hover:bg-[#79b8ff] transition-all ${hasAiRewriteSelection ? 'brightness-110 shadow-[0_0_16px_rgba(88,166,255,0.35)]' : ''} disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-[#58a6ff]`}
                        >
                          <Wand2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                          Rewrite
                        </button>

                        {aiRewriteError ? (
                          <div className="mt-2 text-xs text-[#f85149]">{aiRewriteError}</div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {hasAiRewriteResult && !isAiRewriteLoading && (
                    <motion.div
                      variants={AI_REWRITE_ACTION_ROW_VARIANTS}
                      initial="hidden"
                      animate="show"
                      exit="hidden"
                      className="flex items-center gap-4 mt-2 text-xs"
                    >
                      <motion.button type="button" variants={AI_REWRITE_ACTION_ITEM_VARIANTS} onClick={() => { closeAiRewritePanel(); setHasAiRewriteResult(false); setAiRewriteError(''); }} className="text-xs font-medium text-[#3fb950] hover:text-[#56d364] cursor-pointer transition-colors">
                        Accept
                      </motion.button>
                      <motion.button type="button" variants={AI_REWRITE_ACTION_ITEM_VARIANTS} onClick={() => { closeAiRewritePanel(); setHasAiRewriteResult(false); setAiRewriteError(''); window.requestAnimationFrame(() => textareaRef.current?.focus()); }} className="text-xs font-medium text-[#58a6ff] hover:brightness-110 cursor-pointer transition">
                        Edit
                      </motion.button>
                      <motion.button type="button" variants={AI_REWRITE_ACTION_ITEM_VARIANTS} onClick={() => { if (originalDraft) setContent(originalDraft); closeAiRewritePanel(); setHasAiRewriteResult(false); setAiRewriteError(''); }} className="text-xs font-medium text-[#f85149] hover:text-[#ff7b72] cursor-pointer transition-colors">
                        Undo
                      </motion.button>
                      <motion.button type="button" variants={AI_REWRITE_ACTION_ITEM_VARIANTS} onClick={() => void runAiRewrite({ sourceText: originalDraft || content, styleId: lastAiRewriteConfig.styleId || selectedStyle, personalityId: lastAiRewriteConfig.personalityId || selectedPersonality, preserveOriginal: true })} disabled={!canRetryAiRewrite} className={`text-xs font-medium text-[#e6edf3] hover:text-[#e6edf3] transition-colors ${canRetryAiRewrite ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}>
                        Retry
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {imagePreview && (
                  <div className="mt-3 relative inline-block">
                    <img src={imagePreview} alt="Composer preview" className="max-h-56 rounded-xl border" style={{ borderColor: T.border }} />
                    <button type="button" onClick={removeImage} className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center" style={{ color: T.text }}>
                      <X size={13} strokeWidth={1.5} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div {...modalSectionMotion(4)} className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: T.border }}>
              <div className="inline-flex items-center gap-2 text-xs" style={{ color: T.text }}>
                <UserAvatar user={{ ...(currentUser || {}), display_name: composerDisplayName, avatar_url: composerAvatarUrl }} size={24} initialsClassName="text-[10px]" />
                <span>Posting as {composerDisplayName}</span>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={isAiRewriteLoading || submitting || (!content.trim() && !imageFile && !(postType === 'pnl' && selectedTrade))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#58a6ff] text-black text-sm font-semibold shadow-lg shadow-[#58a6ff]/20 transition-all duration-200 hover:bg-[#79b8ff] hover:scale-105 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-4 h-4 text-black animate-spin" /> : <Send className="w-4 h-4 text-black" />}
                Publish
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PostComposerModal;
