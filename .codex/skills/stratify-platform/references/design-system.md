# Stratify Design System

## Visual Direction

Adopt a terminal-pro dark interface with high information density, clear hierarchy, and restrained color accents.

## Core UI Rules

1. Keep backgrounds dark and layered; avoid flat single-tone panels.
2. Use strong contrast for primary text and low-contrast secondary metadata.
3. Keep spacing compact but readable for trader workflows.
4. Use consistent radius, border, and shadow primitives across panels.
5. Reserve vivid accent colors for status, risk, and action states.

## Typography

1. Use monospaced or terminal-compatible typography for symbols, prices, and logs.
2. Keep heading styles bold and compact.
3. Keep numeric columns tabular and aligned for quick scanning.

## Interaction Patterns

1. Prioritize instant feedback on tab changes by using preloaded data.
2. Animate only meaningful transitions (panel reveal, data updates, mode switches).
3. Avoid decorative animations that delay interaction.
4. Keep keyboard accessibility for high-frequency actions.

## Component Standards

1. Wrap new pages/components with React Error Boundaries.
2. Use explicit loading, empty, and error states with concise copy.
3. Avoid modal overuse for flows that can remain in-panel.
4. Keep ticker and price display consistent with `$` prefix and status color semantics.

## Quality Bar

1. Verify desktop and mobile layouts.
2. Test hard refresh and navigation return states.
3. Ensure visual consistency with existing dashboard patterns instead of introducing one-off styles.
