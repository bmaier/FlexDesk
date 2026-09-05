---
name: Federal Administrative Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#43474f'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737780'
  outline-variant: '#c3c6d1'
  surface-tint: '#3a5f94'
  primary: '#001e40'
  on-primary: '#ffffff'
  primary-container: '#003366'
  on-primary-container: '#799dd6'
  inverse-primary: '#a7c8ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#00231f'
  on-tertiary: '#ffffff'
  tertiary-container: '#003a35'
  on-tertiary-container: '#38ac9f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a7c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#1f477b'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  gutter: 20px
---

## Brand & Style
The design system is engineered for high-utility, institutional reliability, and modern governance. It adopts a **Corporate / Modern** aesthetic that mirrors the efficiency of high-end SaaS tools while maintaining the authoritative posture required for a federal agency. 

The visual narrative is built on "Trusted Efficiency." It prioritizes clarity over decoration, using a structured layout and a disciplined color palette to reduce cognitive load during workplace transitions. The interface should feel stable, responsive, and neutral, allowing the user's task—securing a workspace—to remain the primary focus.

## Colors
The palette is rooted in federal tradition but executed with digital-first vibrancy.
- **Primary (Navy):** Used for global navigation, headers, and primary branding to establish authority.
- **Secondary (Slate):** Utilized for supporting text, icons, and non-critical UI metadata.
- **Accent (Teal):** The "Action Color." Reserved for primary call-to-actions, successful booking states, and interactive highlights.
- **Background & Surface:** A layered approach using #F8FAFC for the canvas and #FFFFFF for cards and input containers to create subtle functional depth.
- **Focus States:** A high-contrast #2563EB ring is mandatory for all keyboard-navigable elements to exceed WCAG 2.1 AA requirements.

## Typography
The system utilizes **Inter** for its exceptional legibility and neutral, professional tone. 
- **Hierarchy:** Large headlines are reserved for page titles (e.g., "Floor 3 Overview"). 
- **Data Density:** Use `data-tabular` for desk numbers and time slots to ensure numbers align perfectly in lists and grids.
- **Labels:** Small, uppercase labels are used for non-interactive categories to distinguish them from clickable body text.

## Layout & Spacing
This design system employs a **Fixed Grid** on desktop and a **Fluid Grid** on mobile.
- **Desktop:** 12-column grid, 1280px max-width, centered. Use 24px margins.
- **Tablet:** 8-column grid, 16px margins.
- **Mobile:** 4-column grid, 16px margins.
- **Rhythm:** A strict 4px/8px baseline grid ensures vertical consistency. Information density should be high in the "Map View" but comfortable in the "Booking Form" view to prevent user error.

## Elevation & Depth
The system uses **Tonal Layers** supplemented by **Ambient Shadows**.
- **Level 0 (Background):** #F8FAFC. The base layer for the application.
- **Level 1 (Surface):** #FFFFFF. Used for the main content area or inactive cards. No shadow, 1px solid #E2E8F0 border.
- **Level 2 (Interactive):** #FFFFFF. Used for draggable desk cards or hover states. 
  - *Shadow:* 0px 4px 6px -1px rgba(0, 51, 102, 0.05), 0px 2px 4px -1px rgba(0, 51, 102, 0.03).
- **Level 3 (Overlay):** Used for modals and tooltips. 
  - *Shadow:* 0px 20px 25px -5px rgba(0, 0, 0, 0.1).

## Shapes
A consistent 8px (`rounded-md` equivalent) radius is applied to all primary UI elements (buttons, cards, inputs). 
- **Large Surfaces:** Containers and modals use 16px (`rounded-xl`) to soften the institutional feel.
- **Small Elements:** Tooltips and status badges use 4px (`rounded-sm`) to maintain structural integrity at small scales.

## Components
- **Buttons:** 
  - *Primary:* Navy background, White text. 8px radius.
  - *Accent/Action:* Teal background. Use for "Confirm Booking."
  - *Hover:* Lighten background by 10%.
- **Desk Cards:** Use a "Status Strip" on the left edge (Teal for Available, Slate for Occupied). Elements should be draggable for admin reassignments.
- **Input Fields:** 1px solid #CBD5E1 border. On focus, use a 2px Teal border with a soft blue outer glow (shadow).
- **Interactive Map:** Desks are represented as 40x40px rounded squares. Available desks use a subtle Teal border; selected desks use a solid Teal fill.
- **Chips:** For filtering (e.g., "Quiet Zone", "Standing Desk"). Use a light Slate background (#F1F5F9) with Navy text; use a Navy fill with White text when active.
- **Lists:** High-density rows (48px height) with 1px bottom dividers. Use `data-tabular` font for time and date columns.