# CLAUDE.md — fpl0.blog

## Strict Rules (Always Follow)

1. **NEVER use emojis.** Use SVGs or CSS shapes instead.
2. **NEVER use pure white or pure black.** No `#FFFFFF`, `#000000`, `white`, or `black` — always use the warm palette CSS variables.
3. **NEVER add arbitrary font sizes.** Use the type scale variables from `global.css`.
4. **NEVER add borders without `var(--color-border)`.** No hardcoded border colors.
5. **NEVER add shadows without `var(--shadow-color)`.** No hardcoded shadow values.
6. **NEVER add external npm dependencies** unless explicitly asked. Use native Web APIs and Bun built-ins first.
7. **ALWAYS use `var(--font-serif)` for headings and prose.**
8. **ALWAYS use `var(--font-mono-brand)` for metadata, dates, and system labels.**
9. **ALWAYS ensure hover states use `var(--color-primary)`.**
10. **ALWAYS use smooth transitions (0.2s minimum).**
11. **ALWAYS support both light and dark themes via CSS variables.**
12. **ALWAYS include `prefers-reduced-motion: reduce`** when adding animations/transitions.
13. **Consistency**: All styles (colors, links, animations) must be uniform across the entire site.
14. **Strict Aesthetics**: Every new UI/UX implementation must follow the overall aesthetics (colors, typography, measurements).
15. **Modularity**: Break down complex UI into smaller, focused Astro components.

## Stack

- **Astro 5.17+** with MDX, View Transitions (`ClientRouter`), static output
- **TypeScript** / JavaScript (ESNext), strict mode
- **Bun** runtime and package manager (strictly enforced)
- **Fonts**: `@fontsource` packages with `font-display: block` and metric-override fallbacks — no external font requests
- **Integrations**: sitemap, MDX, remark-gfm, custom rehype-task-list-labels
- **Syntax highlighting**: Shiki with CSS variables (`defaultColor: false`), dual themes (github-light-high-contrast / vesper)

## Commands

| Action | Command |
|--------|---------|
| Install deps | `bun install` |
| Dev server | `bun run dev` |
| Production build | `bun run build` (runs image optimization prebuild) |
| Type checking | `bun run validate` (`astro check`) |
| Preview build | `bun run preview` |
| Run tests | `bun test` |

## Code Quality

- **Clean & Concise**: Write minimal, efficient code.
- **DRY**: Extract common logic and styles into reusable components or global CSS variables.
- **CSS**: Keep it clean, organized, and specifically targeted. Prefer standard CSS features over heavy abstractions. Use global CSS variables from `src/styles/global.css` for colors, fonts, and spacing. Responsive design must work flawlessly on all devices.

---

## Design System — "The Digital Antiquarian"

This is the **single source of truth** for visual identity. Every UI element, component, and page MUST adhere to these specifications. Do not deviate. Do not improvise.

### Typography

#### Font Stacks (Use ONLY These)

| Variable | Font | Usage |
|----------|------|-------|
| `--font-sans` | `Inter Variable`, system-ui | Body UI, summaries, navigation labels |
| `--font-serif` | `Merriweather` | **Primary reading font**: headings, article prose, blockquotes |
| `--font-mono-brand` | `Space Mono` | Brand: logo, dates, metadata, error codes (`404`) |
| `--font-mono` | `JetBrains Mono` | Code blocks, inline code, technical content |

#### Type Scale (Strict Minor Third — 1.200)

Framework: Linear interpolation (`slope * vw + intercept`) anchored to strict pixel values. Mobile base: `16px` (1rem), Desktop base: `17px` (1.0625rem).

```css
--font-size-base: clamp(1rem, 0.11vw + 0.96rem, 1.0625rem);
--font-size-h1: clamp(1.728rem, 0.20vw + 1.66rem, 1.836rem);   /* 27.65px -> 29.38px */
--font-size-h2: clamp(1.44rem, 0.16vw + 1.39rem, 1.53rem);     /* 23.04px -> 24.48px */
--font-size-h3: clamp(1.2rem, 0.14vw + 1.15rem, 1.275rem);     /* 19.20px -> 20.40px */
--font-size-body: var(--font-size-base);
--font-size-lead: 1.35rem;
/* UI: --font-size-sm (0.9375rem), --font-size-xs (0.875rem), --font-size-xxs, --font-size-label, --font-size-micro */
```

#### Line Heights

| Variable | Value | Usage |
|----------|-------|-------|
| `--line-height-tight` | 1.1 | Headings |
| `--line-height-snug` | 1.25 | Subheadings |
| `--line-height-subhead` | 1.4 | Subhead elements |
| `--line-height-normal` | 1.5 | UI text |
| `--line-height-relaxed` | 1.6 | Body default (Strict Density) |
| `--line-height-loose` | 1.7 | Long-form prose |

### Color System (HSL-Based, Warm Palette)

#### Light Mode (default — "The Parchment")

```css
/* Backgrounds — warm cream paper, NOT pure white */
--color-bg: hsl(45, 40%, 96%);
--color-surface: hsl(45, 30%, 92%);
--color-surface-raised: hsl(45, 25%, 88%);
--color-highlight: hsl(45, 45%, 90%);
/* Text — deep sepia-brown, NOT pure black */
--color-text: hsl(25, 30%, 18%);
--color-text-secondary: hsl(25, 25%, 35%);
--color-text-muted: hsl(25, 20%, 50%);
/* Accents */
--color-primary: hsl(28, 80%, 38%);        /* Deep Amber */
--color-primary-dim: hsl(28, 60%, 48%);
--color-accent-cool: hsl(180, 30%, 35%);   /* Deep Teal */
/* Borders & Shadows */
--color-border: hsl(35, 25%, 82%);
--color-border-subtle: hsl(35, 20%, 88%);
--shadow-color: rgba(60, 40, 20, 0.12);
```

#### Dark Mode (`[data-theme="dark"]` — "The Archive")

```css
/* Backgrounds — warm charcoal, NOT cold gray */
--color-bg: hsl(20, 15%, 8%);
--color-surface: hsl(20, 12%, 12%);
--color-surface-raised: hsl(20, 10%, 16%);
--color-highlight: hsl(35, 20%, 14%);
/* Text — warm off-white, NOT pure white */
--color-text: hsl(35, 12%, 87%);
--color-text-secondary: hsl(30, 8%, 68%);
--color-text-muted: hsl(25, 6%, 52%);
/* Accents */
--color-primary: hsl(42, 52%, 76%);        /* Gold / Cream */
--color-primary-dim: hsl(42, 35%, 58%);
--color-accent-cool: hsl(180, 20%, 72%);   /* Teal for inline code */
/* Borders & Shadows */
--color-border: hsl(20, 10%, 18%);
--color-border-subtle: hsl(20, 8%, 14%);
--shadow-color: rgba(10, 5, 0, 0.6);
```

### Layout & Spacing

- **Content max-width**: `72ch`
- **Padding**: `4rem 1.5rem` (desktop), `1.5rem 0.75rem` (mobile < 600px)
- **Mobile breakpoint**: `600px`, TOC sidebar: `1440px+`
- **Spacing**: strict 4px/8px grid — all spacing MUST be integer multiples of `0.25rem` (4px). Use `--space-1` through `--space-12` variables.

#### Margin Patterns

- **Headings**: `margin-top: 3rem`, `margin-bottom: 1rem`
- **Paragraphs**: `margin-bottom: 1.5em` (Strict Density)
- **Code blocks / Figures**: `margin: 2.5rem 0`

### Component Patterns

#### The Logo / Brand Mark

```css
.logo {
  font-family: var(--font-mono-brand);
  font-size: 2.2rem;
  font-weight: 500;
  letter-spacing: -0.04em;
  display: flex;
  align-items: baseline;
}
```

#### The Living Cursor (`_`)

The blinking underscore is the brand's signature:

```css
.cursor {
  display: inline-block;
  color: var(--color-primary);
  margin-left: 0.05em;
  width: 0.6em;
  text-align: center;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

#### Links

```css
a {
  color: var(--color-text);
  text-decoration: underline;
  text-decoration-color: var(--color-muted);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
a:hover {
  color: var(--color-primary);
  text-decoration-color: var(--color-primary);
}
```

#### Blockquotes

```css
blockquote {
  border-left: 2px solid var(--color-primary);
  padding-left: 1.5rem;
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--color-muted);
}
blockquote cite {
  font-family: var(--font-mono-brand);
  font-size: var(--font-size-xs);
  letter-spacing: 0.05em;
  color: var(--color-primary);
  font-style: normal;
}
```

#### Code Blocks

- **Background**: `var(--color-surface)` (wrapper has `border: 1px solid var(--color-border)`)
- **Font**: `var(--font-mono)`, `font-size: var(--font-size-xxs)`
- **Border-radius**: `8px` on wrapper, `6px` on buttons
- **Inline code**: `background: var(--color-surface)`, `color: var(--color-accent-cool)`

#### Buttons / Interactive Elements

- **Border**: `1px solid var(--color-border)`
- **Hover**: `background: var(--color-highlight)`, `color: var(--color-primary)`
- **Transition**: `all 0.2s ease`
- **Border-radius**: `4px` – `6px` depending on context

### Animation & Motion

```css
/* Standard transition */
transition: all 0.2s ease;
/* OR for smoother feel */
transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

/* View Transitions */
animation-duration: 0.2s;
animation-timing-function: ease-out;

/* Reduced motion — ALWAYS include */
@media (prefers-reduced-motion: reduce) {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
```

---

## Architecture Rules

### View Transitions are everywhere

Every page uses `ClientRouter`. All client-side code must handle both initial load and subsequent navigations. Three patterns — use the right one:

1. **`onPageReady()`** (preferred) — import from `src/utils/lifecycle.ts`. Manages AbortController cleanup automatically. Pass `signal` to all `addEventListener` calls. Used by: AnchorLinks, ImageLightbox, MermaidDiagram, ScrollToTop, SearchModal, TableOfContents, TableWrapper.

2. **`is:inline` scripts** — for components that cannot import modules (CodeCopyButton, ThemeToggle, Analytics). Use IIFE + guard pattern (`data-initialized`). Must manually listen to both `DOMContentLoaded` and `astro:page-load`.

3. **Web Components** — LiteYouTube uses `connectedCallback`/`disconnectedCallback` with per-instance AbortController. Does NOT use the shared lifecycle utility.

**Never add a bare `DOMContentLoaded` listener without also handling `astro:page-load`.** It will break on client-side navigation.

### Content Collection

- Posts in `src/content/blog/[slug]/index.md` or `.mdx`
- Schema in `src/content/config.ts` — Zod-validated with transforms
- `isDraft: true` by default — set `isDraft: false` to publish
- `summary` must be 50–360 characters
- `date` is computed: `publicationDate ?? createdDate`
- `publicationDate` must be >= `createdDate`

### Component Conventions

- All components are `.astro` files in `src/components/`
- Single layout: `src/layouts/Layout.astro`
- Layout always includes: SearchModal, ScrollToTop, ThemeToggle, Analytics, FontPreload
- Theme flash prevention: inline script in Layout `<head>` reads localStorage before paint
- SearchModal uses singleton pattern — module-level state persists across navigations

### Styling

- Design system in `src/styles/global.css` — CSS custom properties for everything
- Component styles split into: `prose.css`, `code-block.css`, `search-modal.css`, `table-of-contents.css`, `tables.css`, `footnotes.css`, `home.css`, `about.css`, `blog-post.css`, `print.css`, `tags.css`

### Performance

- All CSS inlined at build time (`build.inlineStylesheets: "always"`)
- Viewport-triggered link prefetching enabled
- Images optimized to WebP via Sharp in prebuild
- Analytics deferred until first interaction or 3s timeout
- LiteYouTube defers ~800KB iframe until click
- MermaidDiagram dynamically imports only when needed
- SearchModal lazy-loads `/search.json` at idle time

### Security

- CSP headers in `Layout.astro` — update when adding new external resources
- YouTube embeds use `youtube-nocookie.com` (privacy-enhanced mode)
- RSS feed sanitizes HTML via `sanitize-html`
- `object-src: 'none'` enforced

## File Structure

```
src/
├── components/     21 Astro components
├── content/
│   ├── config.ts   Zod schema
│   └── blog/       Post directories (slug/index.md|mdx)
├── layouts/
│   └── Layout.astro
├── pages/
│   ├── index.astro
│   ├── about.astro
│   ├── 404.astro
│   ├── blog/[slug].astro
│   ├── tags/index.astro
│   ├── tags/[tag].astro
│   ├── rss.xml.ts
│   └── search.json.ts
├── plugins/        Custom rehype plugin
├── styles/         CSS design system + component styles
└── utils/
    ├── lifecycle.ts    onPageReady() — View Transition lifecycle
    └── readingTime.ts  Reading time calculator (200 WPM)
```

## Common Pitfalls

- **Adding a new external resource?** Update the CSP header in `Layout.astro`
- **New interactive component?** Use `onPageReady()` and pass `signal` to all event listeners
- **New `is:inline` script?** Cannot import modules — use IIFE + guard, handle both load events
- **Blog post not showing?** Check `isDraft` — defaults to `true`
- **Summary validation failing?** Must be 50–360 characters
- **Styles not applying in dark mode?** Use CSS custom properties, never hardcoded colors
- **Want to add a dependency?** Don't — use Web APIs and Bun built-ins first, ask the user if truly needed
