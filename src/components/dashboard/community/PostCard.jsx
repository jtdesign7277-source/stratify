import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { T, CARD_VARIANTS, HOVER_LIFT } from './communityConstants';
import {
  toFiniteNumber,
  buildCurrentUserAvatarUrl,
  buildReactionSummary,
  sortByCreatedAtAsc,
  sanitizePostType,
  timeAgo,
  highlightTickers,
  shareToX,
} from './communityHelpers';
import { UserAvatar, PostTypeBadge, PnLCard, ShimmerBlock, XLogoIcon, MoodAvatar, ProBadge } from './CommunityShared';
import { MOOD_LS_KEY, DEFAULT_MOOD } from './communityConstants';
import ReactionBar from './ReactionBar';

const PostCard = ({ post, currentUser, currentUserAvatarUrl, onDelete, displayName, userMood, isPro = false }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(toFiniteNumber(post?.likes_count ?? post?.likes, 0));
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(toFiniteNumber(post?.replies_count ?? post?.comments_count, 0));
  const [loadingReplies, setLoadingReplies] = useState(false);
  const isMock = Boolean(post?.is_mock);

  const initialReactions = useMemo(() => {
    if (Array.isArray(post?.reaction_summary)) return post.reaction_summary;
    return buildReactionSummary(post?.community_reactions || [], currentUser?.id);
  }, [post?.reaction_summary, post?.community_reactions, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || isMock || !post) return;
    let cancelled = false;
    const checkLike = async () => {
      const { data } = await supabase
        .from('community_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!cancelled) setLiked(Boolean(data));
    };
    void checkLike();
    return () => { cancelled = true; };
  }, [post.id, currentUser?.id, isMock]);

  if (!post) return null;

  const resolvedDisplayName = String(displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Trader').trim() || 'Trader';
  const resolvedReplyAvatar = String(currentUserAvatarUrl || currentUser?.avatar_url || buildCurrentUserAvatarUrl(resolvedDisplayName)).trim();

  const toggleLike = async () => {
    if (!currentUser?.id) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    if (isMock) return;
    try {
      if (nextLiked) {
        const { error } = await supabase.from('community_likes').insert({ post_id: post.id, user_id: currentUser.id });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
      setLikesCount((prev) => Math.max(0, prev + (nextLiked ? -1 : 1)));
    }
  };

  const loadReplies = async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      if (isMock) {
        const mockReplies = (post.mock_replies || []).map((reply) => ({
          ...reply,
          reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
        }));
        const sorted = sortByCreatedAtAsc(mockReplies);
        setReplies(sorted);
        setLocalRepliesCount((prev) => Math.max(prev, sorted.length));
        return;
      }

      let { data, error } = await supabase
        .from('community_replies')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) {
        const fallback = await supabase
          .from('community_posts')
          .select('*, community_reactions(emoji, user_id), profiles:user_id(id, display_name, avatar_url, email)')
          .or(`parent_id.eq.${post.id},parent_post_id.eq.${post.id}`)
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const mapped = (data || []).map((reply) => {
        const authorName = String(reply?.author_name || reply?.author || '').trim() || 'Trader';
        const replyAvatar = String(
          reply?.avatar_url
          || reply?.metadata?.bot_avatar_url
          || reply?.metadata?.avatar_url
          || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(authorName)}`
        ).trim();

        return {
          ...reply,
          author_name: authorName,
          avatar_url: replyAvatar,
          profiles: reply?.profiles
            ? { ...reply.profiles, display_name: reply.profiles.display_name || authorName, avatar_url: reply.profiles.avatar_url || replyAvatar }
            : { id: reply?.user_id || `reply-profile-${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, display_name: authorName, avatar_url: replyAvatar, avatar_color: null, email: null },
          reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
        };
      });
      const sorted = sortByCreatedAtAsc(mapped);
      setReplies(sorted);
      setLocalRepliesCount((prev) => Math.max(prev, sorted.length));
    } catch {
      // keep existing replies in local state if fetch fails
    } finally {
      setLoadingReplies(false);
    }
  };

  const submitReply = async () => {
    if (replying) return;
    const trimmed = replyContent.trim();
    if (!trimmed) return;
    const createdAt = new Date().toISOString();
    const localReplyId = Date.now();
    const localReply = {
      id: localReplyId,
      author: resolvedDisplayName,
      author_name: resolvedDisplayName,
      avatar: resolvedReplyAvatar,
      avatar_url: resolvedReplyAvatar,
      content: trimmed,
      timestamp: 'just now',
      created_at: createdAt,
      user_id: currentUser?.id || `guest-${localReplyId}`,
      profiles: {
        id: currentUser?.id || `guest-${localReplyId}`,
        display_name: resolvedDisplayName,
        avatar_url: resolvedReplyAvatar,
        avatar_color: currentUser?.avatar_color || null,
        email: currentUser?.email || null,
      },
      community_reactions: [],
      reaction_summary: [],
      is_mock: isMock || !currentUser?.id,
    };

    setReplies((prev) => sortByCreatedAtAsc([...prev, localReply]));
    setReplyContent('');
    setShowReplies(true);
    setLocalRepliesCount((prev) => prev + 1);
    setReplying(true);

    try {
      if (isMock) return;

      const { data: inserted, error } = await supabase
        .from('community_replies')
        .insert({ post_id: post.id, author_name: resolvedDisplayName, content: trimmed, created_at: createdAt })
        .select('*')
        .single();

      if (error) throw error;

      const persistedReply = {
        ...localReply,
        ...inserted,
        id: inserted?.id || localReplyId,
        author_name: String(inserted?.author_name || resolvedDisplayName).trim() || resolvedDisplayName,
        avatar: localReply.avatar,
        avatar_url: localReply.avatar_url,
        content: String(inserted?.content || trimmed),
        created_at: inserted?.created_at || createdAt,
        timestamp: 'just now',
      };

      setReplies((prev) => sortByCreatedAtAsc(prev.map((row) => (row.id === localReplyId ? persistedReply : row))));
    } catch {
      // optimistic reply already shown; keep local state if persistence fails
    } finally {
      setReplying(false);
    }
  };

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) void loadReplies();
    setShowReplies((open) => !open);
  };

  const profile = {
    id: post?.profiles?.id || post?.user_id || post?.id || post?.author_name || null,
    display_name: post?.profiles?.display_name || post?.author_name,
    avatar_url: post?.profiles?.avatar_url || post?.metadata?.bot_avatar_url || post?.metadata?.avatar_url || post?.avatar_url || null,
    avatar_color: post?.profiles?.avatar_color || post?.avatar_color || post?.metadata?.bot_avatar_color || post?.metadata?.avatar_color || null,
    email: post?.profiles?.email || null,
  };

  const isOwner = currentUser?.id && currentUser.id === post.user_id;
  const profileForRender = isOwner
    ? { ...profile, display_name: resolvedDisplayName, avatar_url: resolvedReplyAvatar }
    : profile;
  const postAuthorLabel = profileForRender?.display_name || post.author_name || profileForRender?.email?.split('@')[0] || 'Trader';
  const repliesCount = Math.max(localRepliesCount, replies.length);
  const normalizedPostType = sanitizePostType(post?.post_type);

  return (
    <motion.article
      variants={CARD_VARIANTS}
      layout
      {...HOVER_LIFT}
      className="rounded-lg border p-3"
      style={{ borderColor: T.border, backgroundColor: T.card }}
    >
      <div className="flex gap-2">
        <div className="relative flex-shrink-0">
          {isOwner ? (
            <MoodAvatar mood={userMood || DEFAULT_MOOD} size={32} />
          ) : (
            <UserAvatar user={profileForRender} size={32} initialsClassName="text-xs" />
          )}
          {isOwner && isPro && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <ProBadge size={14} />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {normalizedPostType !== 'general' && (
            <div className="mb-1">
              <PostTypeBadge type={normalizedPostType} />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold truncate" style={{ color: T.text }}>{postAuthorLabel}</span>
            <span className="text-sm" style={{ color: T.muted }}>•</span>
            <span className="text-sm" style={{ color: T.muted }}>{timeAgo(post.created_at)}</span>
          </div>

          <div
            className="mt-2 text-base leading-relaxed break-words"
            style={{ color: T.text }}
            dangerouslySetInnerHTML={{ __html: highlightTickers(post.content || '') }}
          />

          {normalizedPostType === 'pnl' && <PnLCard metadata={post.metadata} />}

          {post.image_url && (
            <div className="mt-3">
              <img
                src={post.image_url}
                alt="Post attachment"
                className="max-h-96 rounded-xl border object-cover"
                style={{ borderColor: T.border }}
                loading="lazy"
              />
            </div>
          )}

          <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-5" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={() => void toggleLike()}
              className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-[#e6edf3]"
              style={{ color: liked ? T.red : T.muted }}
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} fill={liked ? 'currentColor' : 'none'} />
              <span>Like</span>
              {likesCount > 0 ? <span className="text-sm" style={{ color: T.muted }}>{likesCount}</span> : null}
            </button>

            <button
              type="button"
              onClick={toggleReplies}
              className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-[#e6edf3]"
              style={{ color: T.muted }}
            >
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.5} />
              <span>Reply</span>
              {repliesCount > 0 ? <span className="text-sm" style={{ color: T.muted }}>{repliesCount}</span> : null}
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => shareToX(post)}
                className="inline-flex items-center gap-1.5 text-sm cursor-pointer transition-colors hover:text-[#e6edf3]"
                style={{ color: T.muted }}
              >
                <XLogoIcon className="h-[18px] w-[18px]" />
                <span>Share</span>
              </button>
            )}

            <ReactionBar
              postId={post.id}
              currentUser={currentUser}
              initialReactions={initialReactions}
              inActionRow
              isMock={isMock}
            />
          </div>

          <AnimatePresence initial={false}>
            {showReplies && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t overflow-hidden"
                style={{ borderColor: T.border }}
              >
                {loadingReplies ? (
                  <div className="py-3"><ShimmerBlock lines={2} /></div>
                ) : (
                  <div className="space-y-2">
                    {replies.map((reply) => {
                      const replyProfile = {
                        id: reply?.profiles?.id || reply?.user_id || reply?.id || reply?.author_name || reply?.author || null,
                        display_name: reply?.profiles?.display_name || reply.author_name || reply.author,
                        avatar_url: reply?.profiles?.avatar_url || reply?.metadata?.bot_avatar_url || reply?.metadata?.avatar_url || reply?.avatar_url || reply?.avatar || null,
                        avatar_color: reply?.profiles?.avatar_color || reply?.avatar_color || reply?.metadata?.bot_avatar_color || reply?.metadata?.avatar_color || null,
                        email: reply?.profiles?.email || null,
                      };
                      const isCurrentUserReply = currentUser?.id && reply?.user_id === currentUser.id;
                      const replyProfileForRender = isCurrentUserReply
                        ? { ...replyProfile, display_name: resolvedDisplayName, avatar_url: resolvedReplyAvatar }
                        : replyProfile;
                      return (
                        <div key={reply.id} className="flex gap-2">
                          <UserAvatar user={replyProfileForRender} size={24} initialsClassName="text-xs" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold" style={{ color: T.text }}>
                                {replyProfileForRender.display_name || reply.author_name || reply.author || 'Trader'}
                              </span>
                              <span className="text-sm" style={{ color: T.muted }}>{reply?.timestamp || timeAgo(reply.created_at)}</span>
                            </div>
                            <div className="mt-0.5 text-base break-words leading-relaxed" style={{ color: T.text }} dangerouslySetInnerHTML={{ __html: highlightTickers(reply.content || '') }} />
                            <ReactionBar
                              postId={reply.id}
                              currentUser={currentUser}
                              initialReactions={reply.reaction_summary || buildReactionSummary(reply.community_reactions || [], currentUser?.id)}
                              compact
                              isMock={isMock || Boolean(reply?.is_mock)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <UserAvatar user={{ ...(currentUser || {}), display_name: resolvedDisplayName, avatar_url: resolvedReplyAvatar }} size={24} initialsClassName="text-xs" />
                  <input
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey) return;
                      event.preventDefault();
                      void submitReply();
                    }}
                    placeholder="Write a reply..."
                    className="flex-1 rounded-full border bg-transparent px-3 py-1.5 text-base outline-none"
                    style={{ borderColor: T.border, color: T.text }}
                  />
                  <button
                    type="button"
                    onClick={() => void submitReply()}
                    disabled={replying || !replyContent.trim()}
                    className="h-7 w-7 inline-flex items-center justify-center disabled:opacity-45"
                    style={{ color: T.blue }}
                  >
                    {replying ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
};

export default PostCard;
