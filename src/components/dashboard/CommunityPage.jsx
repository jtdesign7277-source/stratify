import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Send,
  X,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Bell,
  Zap,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Camera,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const extractTickers = (text) => {
  const matches = text.match(/\$[A-Z]{1,6}/g);
  return matches ? [...new Set(matches.map((t) => t.replace('$', '')))] : [];
};

const highlightTickers = (text) => {
  return text.replace(
    /\$([A-Z]{1,6})/g,
    '<span class="text-cyan-400 font-semibold cursor-pointer hover:underline">$$$1</span>'
  );
};

const POST_TYPE_CONFIG = {
  post: { label: null, icon: null, color: null },
  pnl_share: { label: 'P&L', icon: TrendingUp, color: 'emerald' },
  strategy_share: { label: 'Strategy', icon: Zap, color: 'cyan' },
  alert_share: { label: 'Alert', icon: Bell, color: 'amber' },
  trade_share: { label: 'Trade', icon: BarChart3, color: 'blue' },
};

// ─── Share to X ───────────────────────────────────────────
const shareToX = (post) => {
  let text = post.content;
  if (post.post_type === 'pnl_share' && post.metadata?.pnl) {
    const sign = post.metadata.pnl >= 0 ? '+' : '';
    text = `${sign}$${Math.abs(post.metadata.pnl).toLocaleString()} on $${post.metadata.ticker || ''} 📈\n\n${post.content}`;
  }
  text += '\n\nPowered by @StratifyTrading';
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=550,height=420');
};

// ─── Avatar Component ─────────────────────────────────────
const UserAvatar = ({ user, size = 40 }) => {
  const initials = (user?.display_name || user?.email || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name || 'User'}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const colors = [
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-purple-500 to-pink-600',
    'from-red-500 to-rose-600',
    'from-indigo-500 to-violet-600',
  ];
  const colorIdx =
    (user?.id || '')
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center flex-shrink-0`}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.36 }}>
        {initials}
      </span>
    </div>
  );
};

// ─── Post Type Badge ──────────────────────────────────────
const PostTypeBadge = ({ type, metadata }) => {
  const config = POST_TYPE_CONFIG[type];
  if (!config?.label) return null;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/20`}
    >
      <Icon size={12} strokeWidth={1.5} />
      <span>{config.label}</span>
      {metadata?.pnl !== undefined && (
        <span className={metadata.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {metadata.pnl >= 0 ? '+' : ''}${Math.abs(metadata.pnl).toLocaleString()}
        </span>
      )}
    </div>
  );
};

// ─── P&L Card (for pnl_share posts) ──────────────────────
const PnLCard = ({ metadata }) => {
  if (!metadata?.pnl) return null;
  const isPositive = metadata.pnl >= 0;

  return (
    <div
      className={`mt-3 p-4 rounded-xl border ${
        isPositive
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-1">
            {metadata.ticker ? `$${metadata.ticker}` : 'Portfolio'} • {metadata.strategy || 'Manual Trade'}
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isPositive ? '+' : '-'}${Math.abs(metadata.pnl).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          {metadata.percent && (
            <div
              className={`text-lg font-mono font-semibold ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {metadata.percent}%
            </div>
          )}
          {metadata.timeframe && (
            <div className="text-xs text-gray-500">{metadata.timeframe}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Compose Box ──────────────────────────────────────────
const ComposeBox = ({ currentUser, onPost }) => {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postType, setPostType] = useState('post');
  const [pnlAmount, setPnlAmount] = useState('');
  const [pnlTicker, setPnlTicker] = useState('');
  const [pnlPercent, setPnlPercent] = useState('');
  const [posting, setPosting] = useState(false);
  const [showPnlFields, setShowPnlFields] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return;
    setPosting(true);

    try {
      let imageUrl = null;

      // Upload image if present
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('community-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const metadata = {};
      if (postType === 'pnl_share') {
        if (pnlAmount) metadata.pnl = parseFloat(pnlAmount);
        if (pnlTicker) metadata.ticker = pnlTicker.toUpperCase().replace('$', '');
        if (pnlPercent) metadata.percent = parseFloat(pnlPercent);
      }

      const { data: newPost, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          content: content.trim(),
          image_url: imageUrl,
          ticker_mentions: extractTickers(content),
          post_type: postType,
          metadata,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Add the new post to the UI immediately with user profile data
      if (newPost && onPost) {
        const postWithProfile = {
          ...newPost,
          profiles: {
            id: currentUser.id,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
            email: currentUser.email,
          },
        };
        onPost(postWithProfile);
      }

      // Reset
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setPostType('post');
      setPnlAmount('');
      setPnlTicker('');
      setPnlPercent('');
      setShowPnlFields(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error('Post failed:', err);
      alert('Failed to post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 mb-4">
      <div className="flex gap-3">
        <UserAvatar user={currentUser} size={40} />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share a trade, strategy, or insight..."
            className="w-full bg-transparent text-gray-100 placeholder-gray-600 text-sm resize-none outline-none min-h-[60px] max-h-[200px]"
            rows={2}
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative mt-2 inline-block">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="max-h-48 rounded-xl border border-[#1f1f1f] object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          )}

          {/* P&L Fields */}
          {showPnlFields && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={pnlTicker}
                onChange={(e) => setPnlTicker(e.target.value)}
                placeholder="Ticker (NVDA)"
                className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 w-28"
              />
              <input
                value={pnlAmount}
                onChange={(e) => setPnlAmount(e.target.value)}
                placeholder="P&L ($)"
                type="number"
                className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 w-28"
              />
              <input
                value={pnlPercent}
                onChange={(e) => setPnlPercent(e.target.value)}
                placeholder="% gain"
                type="number"
                className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 w-24"
              />
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Add image"
              >
                <Camera size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => {
                  const next = postType === 'pnl_share' ? 'post' : 'pnl_share';
                  setPostType(next);
                  setShowPnlFields(next === 'pnl_share');
                }}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  postType === 'pnl_share' ? 'text-emerald-400' : 'text-gray-500 hover:text-emerald-400'
                }`}
                title="Share P&L"
              >
                <TrendingUp size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => setPostType(postType === 'strategy_share' ? 'post' : 'strategy_share')}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  postType === 'strategy_share' ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'
                }`}
                title="Share Strategy"
              >
                <Zap size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => setPostType(postType === 'trade_share' ? 'post' : 'trade_share')}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  postType === 'trade_share' ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400'
                }`}
                title="Share Trade"
              >
                <BarChart3 size={18} strokeWidth={1.5} />
              </button>

              {postType !== 'post' && (
                <span className="text-xs text-gray-600 ml-2">
                  Posting as <span className="text-gray-400">{POST_TYPE_CONFIG[postType]?.label}</span>
                </span>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={posting || (!content.trim() && !imageFile)}
              className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold text-sm rounded-full transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Single Post Component ────────────────────────────────
const PostCard = ({ post, currentUser, onReply, onDelete }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Check if current user liked this post
  useEffect(() => {
    if (!currentUser) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from('community_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (data) setLiked(true);
    };
    checkLike();
  }, [post.id, currentUser]);

  const toggleLike = async () => {
    if (!currentUser) return;

    if (liked) {
      setLiked(false);
      setLikesCount((c) => c - 1);
      await supabase
        .from('community_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id);
    } else {
      setLiked(true);
      setLikesCount((c) => c + 1);
      await supabase
        .from('community_likes')
        .insert({ post_id: post.id, user_id: currentUser.id });
    }
  };

  const loadReplies = async () => {
    setLoadingReplies(true);
    const { data } = await supabase
      .from('community_posts')
      .select('*, profiles:user_id(id, display_name, avatar_url, email)')
      .eq('parent_id', post.id)
      .order('created_at', { ascending: true });
    setReplies(data || []);
    setLoadingReplies(false);
  };

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) {
      loadReplies();
    }
    setShowReplies(!showReplies);
  };

  const submitReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setReplying(true);

    try {
      const { error } = await supabase.from('community_posts').insert({
        user_id: currentUser.id,
        content: replyContent.trim(),
        parent_id: post.id,
        ticker_mentions: extractTickers(replyContent),
      });

      if (!error) {
        setReplyContent('');
        loadReplies();
      }
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setReplying(false);
    }
  };

  const user = post.profiles || {};
  const isOwner = currentUser?.id === post.user_id;

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 hover:border-[#2a2a2a] transition-colors">
      <div className="flex gap-3">
        <UserAvatar user={user} size={40} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-100 text-sm truncate">
                {user.display_name || user.email?.split('@')[0] || 'Trader'}
              </span>
              <span className="text-gray-600 text-xs">•</span>
              <span className="text-gray-600 text-xs flex-shrink-0">{timeAgo(post.created_at)}</span>
              <PostTypeBadge type={post.post_type} metadata={post.metadata} />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <MoreHorizontal size={16} strokeWidth={1.5} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl py-1 z-20 min-w-[140px]">
                  <button
                    onClick={() => {
                      shareToX(post);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <Share2 size={13} strokeWidth={1.5} />
                    Share to X
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => {
                        onDelete?.(post.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div
            className="text-gray-300 text-sm leading-relaxed mb-2 break-words"
            dangerouslySetInnerHTML={{ __html: highlightTickers(post.content) }}
          />

          {/* P&L Card */}
          {post.post_type === 'pnl_share' && <PnLCard metadata={post.metadata} />}

          {/* Image */}
          {post.image_url && (
            <div className="mt-3">
              <img
                src={post.image_url}
                alt="Post attachment"
                className="max-w-full max-h-[400px] rounded-xl border border-[#1f1f1f] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(post.image_url, '_blank')}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-6 mt-3 pt-2">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                liked ? 'text-red-400' : 'text-gray-600 hover:text-red-400'
              }`}
            >
              <Heart size={15} strokeWidth={1.5} fill={liked ? 'currentColor' : 'none'} />
              <span>{likesCount > 0 ? likesCount : ''}</span>
            </button>

            <button
              onClick={toggleReplies}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-400 transition-colors"
            >
              <MessageCircle size={15} strokeWidth={1.5} />
              <span>{post.replies_count > 0 ? post.replies_count : ''}</span>
            </button>

            <button
              onClick={() => shareToX(post)}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors"
            >
              <Share2 size={15} strokeWidth={1.5} />
            </button>
          </div>

          {/* Replies Section */}
          {showReplies && (
            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              {loadingReplies ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {replies.map((reply) => {
                    const replyUser = reply.profiles || {};
                    return (
                      <div key={reply.id} className="flex gap-2.5">
                        <UserAvatar user={replyUser} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-gray-200 text-xs">
                              {replyUser.display_name || replyUser.email?.split('@')[0] || 'Trader'}
                            </span>
                            <span className="text-gray-700 text-xs">{timeAgo(reply.created_at)}</span>
                          </div>
                          <div
                            className="text-gray-400 text-xs leading-relaxed break-words"
                            dangerouslySetInnerHTML={{ __html: highlightTickers(reply.content) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply Input */}
              <div className="flex items-center gap-2 mt-3">
                <UserAvatar user={currentUser} size={24} />
                <input
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitReply()}
                  placeholder="Write a reply..."
                  className="flex-1 bg-[#0b0b0b] border border-[#1f1f1f] rounded-full px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 transition-colors"
                />
                <button
                  onClick={submitReply}
                  disabled={replying || !replyContent.trim()}
                  className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-30 transition-colors"
                >
                  {replying ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filter Tabs ──────────────────────────────────────────
const FilterTabs = ({ active, onChange }) => {
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pnl_share', label: 'P&L' },
    { key: 'strategy_share', label: 'Strategies' },
    { key: 'trade_share', label: 'Trades' },
    { key: 'alert_share', label: 'Alerts' },
  ];

  return (
    <div className="flex items-center gap-1 mb-4 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            active === tab.key
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ─── Main Community Page ──────────────────────────────────
const CommunityPage = () => {
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.log('[CommunityPage] Current user:', user?.id);

        if (user) {
          // Fetch profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          setCurrentUser({
            id: user.id,
            email: user.email,
            display_name: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
          });
        }
      } catch (err) {
        console.error('[CommunityPage] Failed to get user:', err);
      }
    };
    getUser();
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(
    async (pageNum = 0, append = false) => {
      console.log('[CommunityPage] fetchPosts called:', { pageNum, append, filter });
      setLoading(!append);

      try {
        // First, check if table exists by doing a simple query
        const { data: testData, error: testError } = await supabase
          .from('community_posts')
          .select('id')
          .limit(1);

        if (testError) {
          console.error('[CommunityPage] community_posts table check failed:', testError);
          if (testError.code === '42P01') {
            alert('Community feature is not yet set up. Please contact support to enable the community_posts table.');
            setLoading(false);
            return;
          }
        }

        // Table exists, now query with join
        let query = supabase
          .from('community_posts')
          .select('*')
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (filter !== 'all') {
          query = query.eq('post_type', filter);
        }

        const { data: postsData, error: postsError } = await query;

        if (postsError) {
          console.error('[CommunityPage] fetchPosts query error:', postsError);
          setLoading(false);
          return;
        }

        // Manually fetch profile data for each post
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .in('id', userIds);

        const profilesMap = {};
        (profilesData || []).forEach(p => {
          profilesMap[p.id] = p;
        });

        // Attach profiles to posts
        const data = postsData.map(post => ({
          ...post,
          profiles: profilesMap[post.user_id] || null,
        }));

        const error = null;

        console.log('[CommunityPage] fetchPosts result:', { 
          data, 
          error, 
          count: data?.length,
          errorDetails: error ? JSON.stringify(error) : null 
        });

        if (error) {
          console.error('[CommunityPage] fetchPosts error:', error);
          
          // If the table/relationship doesn't exist, show helpful message
          if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.error('[CommunityPage] community_posts table does not exist. Please create it in Supabase.');
          }
          
          setLoading(false);
          return;
        }

        if (data) {
          if (append) {
            setPosts((prev) => [...prev, ...data]);
          } else {
            setPosts(data);
          }
          setHasMore(data.length === PAGE_SIZE);
        }
      } catch (err) {
        console.error('[CommunityPage] fetchPosts exception:', err);
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    console.log('[CommunityPage] Mount/filter change effect triggered:', { filter });
    setPage(0);
    fetchPosts(0);
  }, [filter, fetchPosts]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: 'parent_id=is.null', // only top-level posts
        },
        async (payload) => {
          // Fetch the full post with profile data
          const { data } = await supabase
            .from('community_posts')
            .select('*, profiles:user_id(id, display_name, avatar_url, email)')
            .eq('id', payload.new.id)
            .maybeSingle();

          if (data) {
            setPosts((prev) => {
              // Avoid duplicates
              if (prev.some((p) => p.id === data.id)) return prev;
              return [data, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_posts',
        },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (postId) => {
    const confirmed = window.confirm('Delete this post?');
    if (!confirmed) return;

    await supabase.from('community_posts').delete().eq('id', postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true);
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0b0b]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-100">Community</h1>
            <p className="text-xs text-gray-600 mt-0.5">Share trades, strategies, and insights with fellow traders</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">Live</span>
            </div>
          </div>
        </div>
        <FilterTabs active={filter} onChange={setFilter} />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-2xl mx-auto">
          {/* Compose */}
          {currentUser && (
            <ComposeBox
              currentUser={currentUser}
              onPost={(newPost) => {
                // Add the new post to the top of the feed immediately
                setPosts((prev) => {
                  // Avoid duplicates
                  if (prev.some((p) => p.id === newPost.id)) return prev;
                  return [newPost, ...prev];
                });
              }}
            />
          )}

          {/* Posts */}
          {loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-gray-600" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-600 text-sm">No posts yet. Be the first to share!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onDelete={handleDelete}
                />
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="text-center py-4">
                  <button
                    onClick={loadMore}
                    className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
