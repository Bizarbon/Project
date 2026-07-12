---
name: Neo-Circuit Design System
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#009bd1'
  on-tertiary-container: '#002d40'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
This design system is built for a high-performance e-commerce environment focused on electronics and emerging technology. The brand personality is **precise, innovative, and secure**. It aims to evoke a sense of "premium reliability"—where technical sophistication meets effortless usability.

The visual style is **Corporate Modern with a Tech-Infusion**. It utilizes a clean, minimalist foundation with generous whitespace to allow high-fidelity product photography to lead the experience. Subtle "digital" flourishes, such as soft glows and precision linework, are used sparingly to signal the advanced nature of the inventory. The AI interface is treated as a "living" element within the system, utilizing light-based visual cues rather than heavy textures.

## Colors
The palette is rooted in a "Deep Space" dark mode to emphasize the luminosity of high-end hardware screens and the vibrant Electric Blue accents.

- **Primary (Electric Blue):** Used exclusively for high-intent actions, primary buttons, and critical states. It represents the "energy" of the brand.
- **Secondary (Slate Navy):** Serves as the primary surface color, providing a softer, more sophisticated alternative to pure black.
- **Tertiary (Cyan Glow):** Used for AI-related accents, active indicators, and subtle gradients to represent "intelligence."
- **Neutral (Ice White):** Used for primary typography and high-contrast borders to ensure maximum legibility against dark backgrounds.

## Typography
The system uses **Inter** for all primary communication due to its exceptional legibility and neutral, technical character. Headlines use a tighter letter-spacing and heavier weights to command authority. 

For technical data, SKU numbers, and AI status indicators, **JetBrains Mono** is introduced to provide a "coded" aesthetic that reinforces the tech-centric nature of the product. Body text remains spacious to ensure technical specifications are easy to scan.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The layout philosophy is "Precision Alignment," where elements are strictly snapped to an 8px baseline grid.

- **Desktop:** Large gutters (24px) provide breathing room for complex product specs. Content is centered within a 1280px max-width container.
- **Mobile:** Margins are reduced to 20px. Content blocks transition to a stacked vertical rhythm.
- **AI Chatbox:** Floats 32px from the bottom-right corner, anchored to the viewport, maintaining its own internal padding logic independent of the page grid.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Ambient Glows** rather than traditional heavy shadows.

- **Level 0 (Base):** Deep Slate Navy (#020617).
- **Level 1 (Cards/Sections):** Slate Gray (#0F172A) with a 1px subtle border (#1E293B).
- **Level 2 (Popovers/Overlays):** Lighter Navy with a very soft, large-radius blue-tinted shadow (0 20px 50px rgba(0, 122, 255, 0.1)).
- **AI Component:** Features a "Backdrop Blur" (Glassmorphism) with a thin 1px gradient border (Electric Blue to Cyan) to signify its distinct, intelligent layer above the standard commerce interface.

## Shapes
The design system adopts a **Rounded** aesthetic (0.5rem base radius). This softens the "coldness" of the dark tech aesthetic, making the professional environment feel more approachable and modern. 

- **Interactive Elements:** Buttons and Input fields use the 0.5rem standard.
- **Product Cards:** Use `rounded-lg` (1rem) to create a distinct frame for imagery.
- **AI Interface:** Uses a mix of `rounded-xl` and full-pill shapes for a "fluid" and organic feel.

## Components
- **Primary Buttons:** High-contrast Electric Blue backgrounds with white text. On hover, they gain a subtle outer glow (0 0 15px rgba(0, 122, 255, 0.5)).
- **Ghost Buttons:** Transparent with a 1px Neutral border. Used for secondary actions like "View Specs."
- **Product Cards:** Minimalist containers. Images are showcased against a slightly lighter gray background than the card itself to create "inset" depth.
- **Input Fields:** Darker than the surface level with a 1px border that turns Electric Blue on focus. Labels use the JetBrains Mono font at a small scale.
- **AI Chatbot Interface:** 
    - **Header:** Gradient background (Electric Blue to Cyan).
    - **Messages:** User bubbles are Slate Gray; AI bubbles are slightly translucent with a subtle cyan inner-glow.
    - **Pulse:** A soft, breathing cyan glow behind the AI avatar indicates "thinking" state.
- **Chips:** Used for technical tags (e.g., "5G", "OLED"). Rectangular with small 4px radius and monospaced type.