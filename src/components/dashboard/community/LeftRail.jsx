import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, BarChart3, Hash, Settings,
  PanelLeftClose, PanelRightClose, ChevronRight, ChevronDown, Trash2, Pencil, Check, X, Plus,
} from 'lucide-react';
import { T, ALL_FEED_HASHTAGS, MAX_VISIBLE_FEED_HASHTAGS, HOVER_LIFT } from './communityConstants';
import { UserAvatar } from './CommunityShared';
import { buildCurrentUserAvatarUrl } from './communityHelpers';

const EXPLORE_TABS = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'finance', label: 'Finance', icon: BarChart3 },
];

const LeftRail = ({
  // collapse
  collapsed,
  onToggleCollapse,
  // feed filter
  filter,
  onFilter,
  // user / profile
  currentUser,
  avatarUrl,
  displayName,
  isEditingName,
  editName,
  setEditName,
  setIsEditingName,
  handleSaveName,
  // feeds customizer
  enabledFeeds = [],
  onOpenFeedCustomizer,
  tweetFolders = [],
  activeTweetFolderId = '',
  onSetActiveTweetFolder,
  onCreateTweetFolder,
  onDeleteTweetFolder,
  onOpenTweetDraft,
  onDeleteTweetDraft,
  onMoveTweetDraft,
  // explore tabs
  activeExploreTab,
  onExploreTabChange,
}) => {
  const [tweetsOpen, setTweetsOpen] = useState(true);
  const [draggedTweetRef, setDraggedTweetRef] = useState(null);
  const [tweetDropTargetFolderId, setTweetDropTargetFolderId] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef(null);
  const isPro = true; // hardcoded until Stripe subscription wired

  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  const profileName = String(displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Trader').trim() || 'Trader';
  const profileAvatarUrl = String(avatarUrl || currentUser?.avatar_url || buildCurrentUserAvatarUrl(profileName)).trim();
  const profileUser = currentUser
    ? { ...currentUser, display_name: profileName, avatar_url: profileAvatarUrl }
    : { id: 'guest-user', display_name: profileName, avatar_url: profileAvatarUrl };

  const feedChannels = ALL_FEED_HASHTAGS.filter((feed) => (Array.isArray(enabledFeeds) ? enabledFeeds : []).includes(feed.id));
  const folders = Array.isArray(tweetFolders) ? tweetFolders : [];
  const activeTweetFolder = (activeTweetFolderId && folders.find((folder) => folder.id === activeTweetFolderId)) || null;

  const openNewFolderInput = () => {
    setTweetsOpen(true);
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const submitNewFolder = () => {
    const name = String(newFolderName || '').trim().slice(0, 28);
    if (!name) {
      setIsCreatingFolder(false);
      setNewFolderName('');
      return;
    }
    onCreateTweetFolder?.(name);
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const cancelNewFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const beginTweetDrag = (event, folderId, tweet) => {
    if (!folderId || !tweet?.id) return;
    const payload = {
      tweetId: String(tweet.id),
      fromFolderId: String(folderId),
    };
    setDraggedTweetRef(payload);
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-stratify-tweet', JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', String(tweet.content || '').slice(0, 120));
    } catch {
      // no-op: fallback uses local draggedTweetRef state
    }
  };

  const endTweetDrag = () => {
    setDraggedTweetRef(null);
    setTweetDropTargetFolderId('');
  };

  const getDraggedTweetPayload = (event) => {
    try {
      const raw = event.dataTransfer.getData('application/x-stratify-tweet');
      if (!raw) return draggedTweetRef;
      const parsed = JSON.parse(raw);
      if (!parsed?.tweetId || !parsed?.fromFolderId) return draggedTweetRef;
      return {
        tweetId: String(parsed.tweetId),
        fromFolderId: String(parsed.fromFolderId),
      };
    } catch {
      return draggedTweetRef;
    }
  };

  const handleFolderDragOver = (event, folderId) => {
    const dragging = draggedTweetRef || getDraggedTweetPayload(event);
    if (!dragging?.tweetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setTweetDropTargetFolderId(String(folderId || ''));
  };

  const handleFolderDrop = (event, folderId) => {
    event.preventDefault();
    const dragging = getDraggedTweetPayload(event);
    if (!dragging?.tweetId || !dragging?.fromFolderId || !folderId) {
      endTweetDrag();
      return;
    }
    onMoveTweetDraft?.(dragging.fromFolderId, folderId, dragging.tweetId);
    endTweetDrag();
  };

  if (collapsed) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: 56 }}
        className="h-full flex-shrink-0 flex flex-col items-center py-3 gap-3 border-r"
        style={{ borderColor: T.border, backgroundColor: T.bg }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
          style={{ color: T.muted }}
          title="Expand sidebar"
        >
          <PanelRightClose size={15} strokeWidth={1.5} />
        </button>

        {EXPLORE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onExploreTabChange?.(activeExploreTab === tab.id ? null : tab.id)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
              style={{ color: activeExploreTab === tab.id ? T.blue : T.muted }}
              title={tab.label}
            >
              <Icon size={15} strokeWidth={1.5} />
            </button>
          );
        })}

        <div className="mt-auto">
          <UserAvatar user={profileUser} size={32} initialsClassName="text-[10px]" />
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: 300 }}
      className="h-full flex-shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: T.border, backgroundColor: T.bg, minWidth: 300, maxWidth: 300 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: T.border }}>
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Community</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/8 transition-colors"
          style={{ color: T.muted }}
          title="Collapse sidebar"
        >
          <PanelLeftClose size={13} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* ── Profile ── */}
        {currentUser && (
          <div className="px-2 py-2 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <UserAvatar user={profileUser} size={40} initialsClassName="text-xs" />
                {isPro && (
                  <svg viewBox="0 0 22 22" className="absolute -bottom-0.5 -right-0.5 w-5 h-5" aria-label="Verified">
                    <g>
                      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.14.272.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.647-.017 1.277-.213 1.818-.567s.972-.854 1.245-1.44c.604.223 1.26.27 1.894.14.634-.132 1.22-.437 1.69-.883.445-.47.75-1.055.88-1.69.131-.634.084-1.29-.139-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z" fill="#1D9BF0"/>
                      <path d="M9.585 14.929l-3.28-3.28 1.168-1.168 2.112 2.112 5.321-5.321 1.168 1.168-6.489 6.489z" fill="white"/>
                    </g>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName?.();
                        if (e.key === 'Escape') setIsEditingName?.(false);
                      }}
                      className="flex-1 min-w-0 bg-white/8 border border-white/15 rounded px-1.5 py-0.5 text-sm outline-none"
                      style={{ color: T.text }}
                      autoFocus
                      maxLength={24}
                    />
                    <button type="button" onClick={handleSaveName} className="text-[#3fb950] hover:brightness-110" title="Save">
                      <Check size={13} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => setIsEditingName?.(false)} className="text-[#7d8590] hover:text-[#e6edf3]" title="Cancel">
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-base font-bold truncate" style={{ color: T.text }}>{profileName}</span>
                    <button
                      type="button"
                      onClick={() => { setEditName?.(profileName); setIsEditingName?.(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: T.muted }}
                      title="Edit display name"
                    >
                      <Pencil size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Explore Tabs ── */}
        {EXPLORE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeExploreTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              onClick={() => onExploreTabChange?.(isActive ? null : tab.id)}
              {...HOVER_LIFT}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors"
              style={{
                color: isActive ? T.blue : T.text,
                backgroundColor: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span>{tab.label}</span>
              {isActive && <ChevronRight size={14} strokeWidth={1.5} className="ml-auto" style={{ color: T.blue }} />}
            </motion.button>
          );
        })}

        {/* ── Feed Channels ── */}
        <div className="pt-2 pb-1">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-base font-bold uppercase tracking-[0.1em]" style={{ color: T.text }}>Feeds</span>
            <button
              type="button"
              onClick={onOpenFeedCustomizer}
              className="hover:text-[#e6edf3] transition-colors"
              style={{ color: T.muted }}
              title="Customize feeds"
            >
              <Settings size={16} strokeWidth={1.5} />
            </button>
          </div>

          {feedChannels.length > 0 ? (
            feedChannels.slice(0, MAX_VISIBLE_FEED_HASHTAGS).map((feed) => {
              const isActive = filter === feed.id;
              return (
                <motion.button
                  key={feed.id}
                  type="button"
                  onClick={() => { onExploreTabChange?.(null); onFilter?.(isActive ? null : feed.id); }}
                  {...HOVER_LIFT}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors"
                  style={{
                    color: isActive ? T.blue : T.text,
                    backgroundColor: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                  }}
                >
                  <Hash size={14} strokeWidth={1.5} />
                  <span className="truncate">{feed.label}</span>
                </motion.button>
              );
            })
          ) : (
            <motion.button
              type="button"
              onClick={onOpenFeedCustomizer}
              {...HOVER_LIFT}
              className="w-full px-2 py-2 text-base text-left rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: T.muted }}
            >
              + Add feed channels
            </motion.button>
          )}
        </div>

        {/* ── Tweets (each folder tab opens to that folder's saved tweets) ── */}
        <div className="pt-2 pb-1">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <button
              type="button"
              onClick={() => setTweetsOpen((prev) => !prev)}
              className="flex-1 flex items-center gap-2 hover:bg-white/5 rounded-lg px-1.5 py-1 transition-colors"
              title="Toggle tweet folders"
            >
              <ChevronRight
                size={12}
                strokeWidth={1.7}
                className={`transition-transform ${tweetsOpen ? 'rotate-90' : ''}`}
                style={{ color: T.muted }}
              />
              <span className="text-base font-bold uppercase tracking-[0.1em]" style={{ color: T.text }}>Tweets</span>
            </button>
            <button
              type="button"
              onClick={openNewFolderInput}
              className="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ color: T.blue }}
              title="Create new folder under Tweets"
              aria-label="Create new tweet folder"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {tweetsOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pl-2 pr-1 space-y-1">
                  {isCreatingFolder ? (
                    <motion.div {...HOVER_LIFT} className="rounded-lg border bg-white/[0.04] p-2 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <input
                        ref={newFolderInputRef}
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitNewFolder();
                          if (e.key === 'Escape') cancelNewFolder();
                        }}
                        placeholder="Folder name"
                        maxLength={28}
                        className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500/50"
                        style={{ color: T.text }}
                      />
                      <button
                        type="button"
                        onClick={submitNewFolder}
                        disabled={!String(newFolderName || '').trim()}
                        className="rounded-md px-2 py-1.5 text-sm font-medium disabled:opacity-40 transition-opacity"
                        style={{ color: T.blue }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={cancelNewFolder}
                        className="rounded-md p-1.5 transition-colors"
                        style={{ color: T.muted }}
                        title="Cancel"
                      >
                        <X size={14} strokeWidth={1.8} />
                      </button>
                    </motion.div>
                  ) : null}
                  {folders.length === 0 && !isCreatingFolder ? (
                    <div className="rounded-lg px-2 py-2 text-base" style={{ color: T.muted, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      No tweet folders yet. Click + to create one.
                    </div>
                  ) : (
                    folders.map((folder) => {
                      const isActiveFolder = activeTweetFolder?.id === folder.id;
                      const folderTweets = Array.isArray(folder?.tweets) ? folder.tweets : [];
                      const folderCount = folderTweets.length;
                      const canDeleteFolder = folder.id !== 'tweets-default';
                      const isDropTarget = tweetDropTargetFolderId === folder.id;
                      return (
                        <motion.div
                          key={folder.id}
                          {...HOVER_LIFT}
                          className="rounded-lg border bg-white/[0.02] transition-colors overflow-hidden"
                          style={{
                            borderColor: isDropTarget ? 'rgba(88,166,255,0.55)' : 'rgba(255,255,255,0.08)',
                            boxShadow: isDropTarget ? '0 0 0 1px rgba(88,166,255,0.25) inset' : 'none',
                          }}
                          onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                          onDragEnter={(event) => handleFolderDragOver(event, folder.id)}
                          onDragLeave={() => {
                            if (tweetDropTargetFolderId === folder.id) setTweetDropTargetFolderId('');
                          }}
                          onDrop={(event) => handleFolderDrop(event, folder.id)}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSetActiveTweetFolder?.(folder.id)}
                              className="flex-1 text-left px-2 py-2 text-base rounded-l-lg transition-colors"
                              style={{
                                color: isActiveFolder ? T.blue : T.text,
                                backgroundColor: isActiveFolder ? 'rgba(88,166,255,0.1)' : 'transparent',
                              }}
                              title={isActiveFolder ? `Close ${folder.name} tweets` : `Open ${folder.name} tweets`}
                            >
                              <span className="font-bold">{folder.name}</span>
                              <span className="ml-1" style={{ color: T.muted }}>({folderCount})</span>
                            </button>
                            {isActiveFolder ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onSetActiveTweetFolder?.(folder.id); }}
                                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/8 transition-colors mr-1"
                                style={{ color: T.muted }}
                                title="Close tweets"
                              >
                                <ChevronDown size={12} strokeWidth={1.8} className="rotate-180" />
                              </button>
                            ) : null}
                            {canDeleteFolder ? (
                              <button
                                type="button"
                                onClick={() => onDeleteTweetFolder?.(folder.id)}
                                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/8 transition-colors mr-1"
                                style={{ color: T.red }}
                                title="Delete folder"
                              >
                                <Trash2 size={11} strokeWidth={1.6} />
                              </button>
                            ) : null}
                          </div>
                          {isActiveFolder && folderTweets.length > 0 && (
                            <div className="border-t border-white/[0.06] pl-2 pr-1 py-1.5 space-y-1">
                              {folderTweets.map((tweet) => (
                                <div
                                  key={tweet.id}
                                  className="group flex items-start gap-2 rounded-lg px-2 py-2 text-base cursor-grab active:cursor-grabbing"
                                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                  draggable
                                  onDragStart={(event) => beginTweetDrag(event, folder.id, tweet)}
                                  onDragEnd={endTweetDrag}
                                >
                                  <button
                                    type="button"
                                    onClick={() => onOpenTweetDraft?.(tweet, folder.id)}
                                    className="flex-1 min-w-0 text-left leading-relaxed hover:text-[#e6edf3] transition-colors font-medium"
                                    style={{ color: T.text }}
                                    title="Open tweet in AI Rewrite"
                                  >
                                    {String(tweet.content || '').slice(0, 140)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTweetDraft?.(folder.id, tweet.id)}
                                    className="opacity-40 group-hover:opacity-100 transition-opacity"
                                    style={{ color: T.red }}
                                    title="Delete tweet"
                                  >
                                    <Trash2 size={11} strokeWidth={1.6} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

      </div>

    </motion.aside>
  );
};

export default LeftRail;
