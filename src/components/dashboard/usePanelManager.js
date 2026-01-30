import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * usePanelManager - Hook for managing multiple collapsible panels
 * 
 * Features:
 * - Tracks expanded/collapsed state for each panel
 * - Persists state to localStorage
 * - Calculates available height distribution
 * - Supports accordion mode (only one open at a time) or free mode (multiple open)
 * 
 * @param {Object} config - Configuration object
 * @param {Array<{id: string, defaultExpanded?: boolean, defaultHeight?: number}>} config.panels - Panel definitions
 * @param {string} config.storageKey - localStorage key prefix
 * @param {boolean} config.accordion - If true, only one panel can be expanded at a time
 * 
 * @returns {Object} Panel manager state and methods
 */
export default function usePanelManager({ panels, storageKey = 'stratify-panels', accordion = false }) {
  // Initialize state from localStorage or defaults
  const [panelStates, setPanelStates] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved state with panel defaults (in case new panels were added)
        const states = {};
        panels.forEach(p => {
          states[p.id] = {
            expanded: parsed[p.id]?.expanded ?? p.defaultExpanded ?? true,
            height: parsed[p.id]?.height ?? p.defaultHeight ?? 200,
          };
        });
        return states;
      }
    } catch (e) {
      console.warn('Failed to load panel state:', e);
    }
    
    // Default state
    const states = {};
    panels.forEach(p => {
      states[p.id] = {
        expanded: p.defaultExpanded ?? true,
        height: p.defaultHeight ?? 200,
      };
    });
    return states;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(panelStates));
  }, [panelStates, storageKey]);

  // Toggle a panel's expanded state
  const togglePanel = useCallback((panelId) => {
    setPanelStates(prev => {
      const newStates = { ...prev };
      
      if (accordion) {
        // Accordion mode: collapse all others, toggle this one
        Object.keys(newStates).forEach(id => {
          if (id === panelId) {
            newStates[id] = { ...newStates[id], expanded: !newStates[id].expanded };
          } else {
            newStates[id] = { ...newStates[id], expanded: false };
          }
        });
      } else {
        // Free mode: just toggle this panel
        newStates[panelId] = { ...newStates[panelId], expanded: !newStates[panelId].expanded };
      }
      
      return newStates;
    });
  }, [accordion]);

  // Set a panel's expanded state directly
  const setExpanded = useCallback((panelId, expanded) => {
    setPanelStates(prev => {
      const newStates = { ...prev };
      
      if (accordion && expanded) {
        // Accordion mode: collapse all others when expanding
        Object.keys(newStates).forEach(id => {
          newStates[id] = { ...newStates[id], expanded: id === panelId };
        });
      } else {
        newStates[panelId] = { ...newStates[panelId], expanded };
      }
      
      return newStates;
    });
  }, [accordion]);

  // Set a panel's height
  const setHeight = useCallback((panelId, height) => {
    setPanelStates(prev => ({
      ...prev,
      [panelId]: { ...prev[panelId], height },
    }));
  }, []);

  // Expand all panels
  const expandAll = useCallback(() => {
    if (accordion) return; // Can't expand all in accordion mode
    setPanelStates(prev => {
      const newStates = {};
      Object.keys(prev).forEach(id => {
        newStates[id] = { ...prev[id], expanded: true };
      });
      return newStates;
    });
  }, [accordion]);

  // Collapse all panels
  const collapseAll = useCallback(() => {
    setPanelStates(prev => {
      const newStates = {};
      Object.keys(prev).forEach(id => {
        newStates[id] = { ...prev[id], expanded: false };
      });
      return newStates;
    });
  }, []);

  // Get props for a specific panel
  const getPanelProps = useCallback((panelId) => {
    const state = panelStates[panelId] || { expanded: true, height: 200 };
    return {
      expanded: state.expanded,
      defaultHeight: state.height,
      onToggle: () => togglePanel(panelId),
      onHeightChange: (height) => setHeight(panelId, height),
    };
  }, [panelStates, togglePanel, setHeight]);

  // Calculate how many panels are expanded
  const expandedCount = useMemo(() => {
    return Object.values(panelStates).filter(s => s.expanded).length;
  }, [panelStates]);

  // Check if a specific panel is expanded
  const isExpanded = useCallback((panelId) => {
    return panelStates[panelId]?.expanded ?? false;
  }, [panelStates]);

  return {
    panelStates,
    togglePanel,
    setExpanded,
    setHeight,
    expandAll,
    collapseAll,
    getPanelProps,
    expandedCount,
    isExpanded,
  };
}
