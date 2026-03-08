import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutGrid, HelpCircle, AlarmClock, RefreshCw, ChevronUp, Folder } from 'lucide-react';

const CONDITION_TYPES = [{ id: 'price', label: 'Price' }];
const CROSSING_OPTIONS = [
  { id: 'above', label: 'Above' },
  { id: 'below', label: 'Below' },
  { id: 'crossing', label: 'Crossing' },
];
const TRIGGER_OPTIONS = [
  { id: 'once', label: 'Once only', subtitle: 'Triggers once when condition is met', icon: 'once' },
  { id: 'every', label: 'Every time', subtitle: 'Triggers once per minute while condition remains met', icon: 'every' },
];

export default function CreateAlertModal({ open, onClose, symbol = '', defaultPrice = '', onCreate, getAlerts, getAllAlerts, onAlertToggle }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [conditionType, setConditionType] = useState('price');
  const [crossing, setCrossing] = useState('above');
  const [value, setValue] = useState('');
  const [trigger, setTrigger] = useState('once');
  const [triggerDropdownOpen, setTriggerDropdownOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [folderAlerts, setFolderAlerts] = useState([]);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      const raw = defaultPrice != null && defaultPrice !== '' ? parseFloat(defaultPrice) : NaN;
      setValue(Number.isFinite(raw) ? Number(raw).toFixed(2) : '');
      setMessage('');
      setAlertEnabled(true);
      setTriggerDropdownOpen(false);
    }
  }, [open, defaultPrice]);

  useEffect(() => {
    if (activeTab === 'folder' && open) {
      const list = typeof getAllAlerts === 'function' ? (getAllAlerts() || []) : (typeof getAlerts === 'function' ? (getAlerts() || []) : []);
      setFolderAlerts(list);
    }
  }, [activeTab, open]);

  useEffect(() => {
    if (!triggerDropdownOpen) return;
    const onMouseDown = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setTriggerDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [triggerDropdownOpen]);

  const handleCreate = () => {
    const price = Number((parseFloat(value) || 0).toFixed(2));
    if (!Number.isFinite(price) || !onCreate) return;
    const direction = crossing === 'crossing' ? 'above' : crossing;
    onCreate(price, direction, 'eod', { message: message.trim() || undefined, enabled: alertEnabled });
    onClose?.();
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b0b0b] shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Create alert on {symbol || '—'}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 px-4">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-emerald-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('message')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'message' ? 'border-emerald-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Message
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('folder')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'folder' ? 'border-emerald-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <Folder className="w-3.5 h-3.5" strokeWidth={1.5} />
              Folder
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'notifications' ? 'border-emerald-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Notifications
              <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500/90 text-[10px] font-bold text-white">2</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {activeTab === 'settings' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500 shrink-0">Symbols</span>
                  <div className="flex items-center gap-2 min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                    <span className="font-semibold text-red-400">{symbol?.charAt(0) || '—'}</span>
                    <span>{symbol || '—'}, Regular trading hours</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-gray-500">Condition</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={conditionType}
                      onChange={(e) => setConditionType(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#0a0a0f] text-sm text-white px-3 py-2"
                    >
                      {CONDITION_TYPES.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <select
                      value={crossing}
                      onChange={(e) => setCrossing(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#0a0a0f] text-sm text-white px-3 py-2"
                    >
                      {CROSSING_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-500">Value</span>
                    <div className="flex items-center rounded-lg border border-blue-500/50 bg-[#0a0a0f] focus-within:ring-1 focus-within:ring-blue-400/50">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={value}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || v === '-') {
                            setValue(v);
                            return;
                          }
                          const n = parseFloat(v);
                          if (Number.isFinite(n)) {
                            const rounded = Math.round(n * 100) / 100;
                            setValue(String(rounded));
                          }
                        }}
                        onBlur={() => {
                          const n = parseFloat(value);
                          if (Number.isFinite(n)) setValue(Number(n).toFixed(2));
                        }}
                        placeholder="0.00"
                        className="w-24 bg-transparent text-sm text-white px-3 py-2 focus:outline-none"
                      />
                      <div className="flex flex-col pr-1 text-gray-500">
                        <button type="button" className="p-0.5" onClick={() => setValue((v) => (Math.round((parseFloat(v) || 0) * 100 + 1) / 100).toFixed(2))}>▲</button>
                        <button type="button" className="p-0.5" onClick={() => setValue((v) => (Math.round((parseFloat(v) || 0) * 100 - 1) / 100).toFixed(2))}>▼</button>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    + Add condition
                    <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 shrink-0">Trigger</span>
                  <div className="relative" ref={triggerRef}>
                    <button
                      type="button"
                      onClick={() => setTriggerDropdownOpen((o) => !o)}
                      className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-[#0a0a0f] text-sm text-white px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <span>{TRIGGER_OPTIONS.find((o) => o.id === trigger)?.label ?? 'Once only'}</span>
                      <ChevronUp className={`w-4 h-4 text-gray-500 transition-transform ${triggerDropdownOpen ? '' : 'rotate-180'}`} strokeWidth={1.8} />
                    </button>
                    {triggerDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-white/15 bg-[#25252d] py-1 shadow-xl z-10 min-w-[260px]">
                        {TRIGGER_OPTIONS.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => { setTrigger(o.id); setTriggerDropdownOpen(false); }}
                            className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors rounded-md ${trigger === o.id ? 'bg-white/15' : 'hover:bg-white/10'}`}
                          >
                            <span className="relative flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border border-white/15 bg-white/5">
                              <AlarmClock className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                              {o.icon === 'once' && (
                                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-gray-300">1</span>
                              )}
                              {o.icon === 'every' && (
                                <RefreshCw className="absolute w-4 h-4 text-gray-400 -bottom-0.5 -right-0.5" strokeWidth={1.8} />
                              )}
                            </span>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-white">{o.label}</span>
                              <span className="text-xs text-gray-400 mt-0.5 leading-relaxed">{o.subtitle}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {activeTab === 'message' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-500">Note for this alert</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a message or note for yourself (optional)"
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-[#0a0a0f] text-sm text-white px-3 py-2.5 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                />
                <p className="text-xs text-gray-500">This note is saved with the alert when you click Create.</p>
              </div>
            )}
            {activeTab === 'folder' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-500">All alerts</span>
                {folderAlerts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">No alerts yet. Create one in Settings.</p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {folderAlerts.map((a) => (
                      <li
                        key={`${a.symbol ?? symbol}-${a.price}-${a.direction}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0a0a0f] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-gray-400 font-mono">
                            {a.symbol ? (
                              <span className="text-emerald-400/90">{a.symbol}</span>
                            ) : null}
                            {a.symbol ? ' · ' : ''}
                            ${Number(a.price).toFixed(2)} {a.direction}
                          </div>
                          <div className="text-sm text-white mt-0.5 truncate">
                            {a.message && a.message.trim() ? a.message.trim() : 'No note'}
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={a.enabled}
                          onClick={() => {
                            const next = !a.enabled;
                            const sym = a.symbol ?? symbol;
                            onAlertToggle?.(sym, a.price, a.direction, next);
                            setFolderAlerts((prev) =>
                              prev.map((x) =>
                                (x.symbol ?? symbol) === sym && x.price === a.price && x.direction === a.direction ? { ...x, enabled: next } : x
                              )
                            );
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 ${a.enabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                        >
                          <span className="sr-only">Alert {a.enabled ? 'on' : 'off'}</span>
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${a.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                            style={{ marginTop: 2 }}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {activeTab === 'notifications' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-gray-500">Notification preferences</span>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a0a0f] px-3 py-2.5">
                  <span className="text-sm text-white">Alert</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertEnabled}
                    onClick={() => setAlertEnabled((on) => !on)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 focus:ring-offset-transparent ${alertEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                  >
                    <span className="sr-only">Alert {alertEnabled ? 'on' : 'off'}</span>
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${alertEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                      style={{ marginTop: 2 }}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {alertEnabled ? 'Alert is on — you’ll be notified when the condition is met.' : 'Alert is off — no notifications until you turn it on.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-white/[0.02]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!value || !Number.isFinite(parseFloat(value))}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
