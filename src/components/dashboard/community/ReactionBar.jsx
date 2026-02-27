import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import EmojiPicker, { EmojiGlyph } from '../EmojiPicker';
import { T, OVERLAY_PANEL_TRANSITION } from './communityConstants';
import { applyReactionState } from './communityHelpers';

const ReactionBar = ({
  postId,
  currentUser,
  initialReactions = [],
  compact = false,
  inActionRow = false,
  isMock = false,
}) => {
  const [reactions, setReactions] = useState(initialReactions || []);
  const [showPicker, setShowPicker] = useState(false);
  const interactive = Boolean(currentUser?.id);

  useEffect(() => {
    setReactions(initialReactions || []);
    setShowPicker(false);
  }, [postId, initialReactions]);

  const toggleReaction = async (emoji) => {
    if (!interactive || !emoji) return;
    const active = reactions.find((reaction) => reaction.emoji === emoji);
    const shouldReact = !active?.reacted;
    const previous = [...reactions];
    setReactions((prev) => applyReactionState(prev, emoji, shouldReact));

    if (isMock) return;

    try {
      if (shouldReact) {
        const { error } = await supabase.from('community_reactions').insert({
          post_id: postId,
          user_id: currentUser.id,
          emoji,
        });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .eq('emoji', emoji);
        if (error) throw error;
      }
    } catch {
      setReactions(previous);
    }
  };

  const trigger = (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShowPicker((openState) => !openState)}
        disabled={!interactive}
        className={`inline-flex items-center gap-1 ${compact ? 'text-[11px]' : 'text-xs'} transition-colors ${interactive ? '' : 'cursor-not-allowed opacity-70'}`}
        style={{ color: interactive ? T.muted : 'rgba(125,133,144,0.5)' }}
      >
        <SmilePlus className={inActionRow ? 'h-3.5 w-3.5' : compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {inActionRow ? <span>React</span> : null}
      </button>

      <AnimatePresence initial={false}>
        {showPicker && interactive && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={OVERLAY_PANEL_TRANSITION}
          >
            <EmojiPicker
              align={compact ? 'right' : 'left'}
              onClose={() => setShowPicker(false)}
              onSelect={(emoji) => {
                setShowPicker(false);
                void toggleReaction(emoji);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );

  if (inActionRow) {
    return (
      <>
        {trigger}
        {reactions.length > 0 ? (
          <div className="w-full mt-1 flex flex-wrap gap-1">
            <AnimatePresence initial={false}>
              {reactions.map((reaction) => (
                <motion.button
                  key={`${postId}-${reaction.emoji}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => void toggleReaction(reaction.emoji)}
                  disabled={!interactive}
                  className="inline-flex items-center gap-0.5 text-xs"
                  style={{ color: reaction.reacted ? T.blue : T.muted }}
                >
                  <EmojiGlyph emoji={reaction.emoji} size={13} />
                  <span className="font-semibold">{reaction.count}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className={compact ? 'mt-1' : 'mt-2'}>
      <div className="flex flex-wrap items-center gap-1.5">
        {trigger}
        <AnimatePresence initial={false}>
          {reactions.map((reaction) => (
            <motion.button
              key={`${postId}-${reaction.emoji}`}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.16 }}
              onClick={() => void toggleReaction(reaction.emoji)}
              disabled={!interactive}
              className="inline-flex items-center gap-0.5 text-xs"
              style={{ color: reaction.reacted ? T.blue : T.muted }}
            >
              <EmojiGlyph emoji={reaction.emoji} size={13} />
              <span className="font-semibold">{reaction.count}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ReactionBar;
