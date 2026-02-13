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
16. **NEVER hardcode design token values.** Use `var(--color-*)` for colors, `var(--font-*)` for font families, `var(--font-size-*)` for font sizes, `var(--space-*)` for spacing, `var(--z-*)` for z-index, `var(--radius-*)` for border-radius, `var(--duration-*)` / `var(--ease-*)` for transitions. No raw `hsl()`, `rgb()`, hex colors, font names, `rem`/`px` sizes, or `cubic-bezier()`. Run `bun run lint:design` to catch violations. Add `/* token-exempt */` only for third-party brand colors or truly unique values.

## Stack

- **Astro 5.17+** with MDX, View Transitions (`ClientRouter`), static output
- **TypeScript** / JavaScript (ESNext), strict mode
- **Bun** runtime and package manager (strictly enforced)
- **Biome** for linting and formatting (`bun run lint` / `bun run format`)
- **Fonts**: `@fontsource` packages with `font-display: block` and metric-override fallbacks — no external font requests
- **Integrations**: sitemap, MDX, remark-gfm, custom rehype-task-list-labels
- **Syntax highlighting**: Shiki with CSS variables (`defaultColor: false`), dual themes (github-light-high-contrast / vesper)

## Commands

| Action | Command |
|--------|---------|
| Install deps | `bun install` |
| Dev server | `bun run dev` |
| Production build | `bun run build` |
| Type checking | `bun run validate` (`astro check`) |
| Lint + format check | `bun run lint` (Biome) |
| Auto-format | `bun run format` (Biome) |
| Token lint | `bun run lint:design` (design token checker) |
| Full quality gate | `bun run check` (validate + lint + lint:design) |
| Preview build | `bun run preview` |
| Scaffold a blog post | `bun run 0:new:post` |
| Scaffold an app | `bun run 0:new:app` |
| List all content | `bun run 0:list` (`--drafts` / `--published`) |
| Publish by slug | `bun run 0:publish <slug>` |
| Delete by slug | `bun run 0:delete <slug>` |

## Code Quality

- **Clean & Concise**: Write minimal, efficient code.
- **DRY**: Extract common logic and styles into reusable components or global CSS variables. Use `getPublishedPosts()` from `src/utils/posts.ts` for post fetching and `getPublishedApps()` from `src/utils/apps.ts` for app fetching — never duplicate the filter/sort logic. Use `getFeedItems()` from `src/utils/feed.ts` for the mixed chronological feed.
- **Pre-commit hook**: A git pre-commit hook runs `bun run check` automatically. CI does not run checks — it only builds and deploys.
- **Linting**: Biome enforces consistent style. Run `bun run format` to auto-fix.
- **CSS**: Keep it clean, organized, and specifically targeted. Prefer standard CSS features over heavy abstractions. Use global CSS variables from `src/styles/global.css` for colors, fonts, and spacing. Responsive design must work flawlessly on all devices.

---

## Design System — "The Digital Antiquarian"

This is the **single source of truth** for visual identity. Every UI element, component, and page MUST adhere to these specifications. Do not deviate. Do not improvise.

### Recent Refinements (2026-02-12)

The design system underwent a comprehensive token-based refinement to ensure consistency and maintainability:

1. **Token Scales**: Added border-radius (6 tokens), z-index (8 tokens), transition easing/duration (5 tokens), and content-width (2 tokens) to eliminate hardcoded values
2. **Color Hierarchy**: Improved perceptual distinction between `--color-text-secondary` and `--color-text-muted` in both themes
3. **Dark Mode Code Blocks**: Added 6 dedicated code tokens to create visual distinction from page background
4. **Typography**: Standardized Merriweather to `font-weight: 400` in both themes; fixed ordered list alignment with `list-style-position: outside`
5. **Reduced Motion**: Replaced blanket animation/transition disabling with targeted approach that preserves color/opacity transitions while disabling motion

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

#### Font Weights

Merriweather (serif) uses `font-weight: 400` in both light and dark modes for improved readability. The previous approach (300 in light, 400 in dark) created inconsistent rendering. Body prose (`.content`) and bio text both use 400 uniformly.

#### List Typography

Ordered lists use `list-style-position: outside` with `padding-left: 1.5em` to align wrapped text under the first line of text, not under the list number. This creates proper typographic hierarchy and readability for multi-line list items.

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
--color-text-secondary: hsl(25, 25%, 28%);  /* Perceptually distinct from muted */
--color-text-muted: hsl(25, 20%, 38%);
/* Accents */
--color-primary: hsl(28, 80%, 38%);        /* Deep Amber */
--color-primary-dim: hsl(28, 60%, 48%);
--color-accent-cool: hsl(180, 30%, 35%);   /* Deep Teal */
/* Borders & Shadows */
--color-border: hsl(35, 25%, 82%);
--color-border-subtle: hsl(35, 20%, 88%);
--shadow-color: rgba(60, 40, 20, 0.12);
/* Code Blocks (light mode) */
--color-code-bg: hsl(40, 30%, 95%);
--color-code-border: hsl(35, 25%, 85%);
--color-code-header-bg: hsl(40, 25%, 92%);
--color-code-inline-bg: hsl(40, 30%, 90%);
--color-code-inline-text: hsl(25, 50%, 35%);
--color-code-inline-border: hsl(35, 25%, 80%);
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
--color-text-secondary: hsl(30, 10%, 60%);  /* Perceptually distinct from muted */
--color-text-muted: hsl(25, 6%, 52%);
/* Accents */
--color-primary: hsl(42, 52%, 76%);        /* Gold / Cream */
--color-primary-dim: hsl(42, 35%, 58%);
--color-accent-cool: hsl(180, 20%, 72%);   /* Teal for inline code */
/* Borders & Shadows */
--color-border: hsl(20, 10%, 18%);
--color-border-subtle: hsl(20, 8%, 14%);
--shadow-color: rgba(10, 5, 0, 0.6);
/* Code Blocks (dark mode — distinct from page bg) */
--color-code-bg: hsl(20, 10%, 11%);
--color-code-border: hsl(20, 8%, 16%);
--color-code-header-bg: hsl(20, 8%, 14%);
--color-code-inline-bg: hsl(20, 10%, 14%);
--color-code-inline-text: hsl(180, 20%, 72%);
--color-code-inline-border: hsl(20, 8%, 18%);
```

### Layout & Spacing

- **Content max-width**: `var(--content-width)` (72ch), narrow variant: `var(--content-width-narrow)` (60ch)
- **Padding**: `4rem 1.5rem` (desktop), `1.5rem 1rem` (mobile < 600px)
- **Mobile breakpoint**: `600px`, TOC sidebar: `1440px+`
- **Spacing**: strict 4px/8px grid — all spacing MUST be integer multiples of `0.25rem` (4px). Use `--space-1` through `--space-12` variables.

#### Border Radius Scale

Use token variables for all border-radius values:

- `--radius-sm: 4px` — Small elements (checkboxes, small buttons, inline code)
- `--radius-md: 6px` — Medium elements (buttons, input fields, tables)
- `--radius-lg: 8px` — Large elements (code blocks, cards, modals)
- `--radius-xl: 12px` — Extra large elements (major containers, tweet cards)
- `--radius-full: 999px` — Pill-shaped elements (tags)
- `--radius-round: 50%` — Circular elements (avatars, toggle buttons)

#### Z-Index Scale

Use token variables for all z-index layering:

- `--z-base: 1` — Base layer (slight elevation)
- `--z-float: 10` — Floating UI (code language labels, toggle buttons)
- `--z-dropdown: 20` — Dropdown menus (copy buttons)
- `--z-sticky: 50` — Sticky positioned elements (app shell bar)
- `--z-fixed: 100` — Fixed positioned elements (scroll-to-top, theme toggle)
- `--z-overlay: 1000` — Overlays (lightbox backdrop, search backdrop)
- `--z-modal: 1010` — Modals (search modal)
- `--z-toast: 9000` — Toast notifications (skip-link)

#### Margin Patterns

- **Headings**: `margin-top: 3rem`, `margin-bottom: 1rem`
- **Paragraphs**: `margin-bottom: 1.5em` (Strict Density)
- **Code blocks / Figures**: `margin: 2.5rem 0`

### Component Patterns

#### The Logo / Brand Mark

Use the `<Logo>` component (`src/components/Logo.astro`):

```astro
<Logo text="fpl0" />
<Logo text="404" class="logo-404" />
```

The Logo component encapsulates the brand mark with the living cursor animation. Pass `text` for the display text and optional `class` for layout overrides.

#### The Living Cursor (`_`)

The blinking underscore is the brand's signature, built into the `<Logo>` component:

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
  transition: all var(--duration-normal) var(--ease-out);
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
  letter-spacing: 0.04em;
  color: var(--color-primary);
  font-style: normal;
}
```

#### Code Blocks

- **Background**: `var(--color-code-bg)` in both themes (distinct from page background)
- **Border**: `1px solid var(--color-code-border)`
- **Font**: `var(--font-mono)`, `font-size: var(--font-size-xxs)`
- **Border-radius**: `var(--radius-lg)` on wrapper, `var(--radius-md)` on buttons
- **Inline code**: `background: var(--color-code-inline-bg)`, `color: var(--color-code-inline-text)`, `border: 1px solid var(--color-code-inline-border)`

#### Buttons / Interactive Elements

- **Border**: `1px solid var(--color-border)`
- **Hover**: `background: var(--color-highlight)`, `color: var(--color-primary)`
- **Transition**: Use token variables — `transition: all var(--duration-normal) var(--ease-out)`
- **Border-radius**: Use scale tokens (`var(--radius-sm)` through `var(--radius-xl)`)

### Animation & Motion

#### Transition Tokens

Use token variables for consistent timing and easing:

```css
/* Easing functions */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);     /* Standard smooth easing */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* Spring/bounce effect */

/* Durations */
--duration-fast: 0.15s;    /* Quick interactions */
--duration-normal: 0.2s;   /* Standard transitions */
--duration-slow: 0.3s;     /* Deliberate animations (modals, overlays) */

/* Standard usage */
transition: all var(--duration-normal) var(--ease-out);
transition: color var(--duration-normal) var(--ease-out);

/* View Transitions */
animation-duration: var(--duration-normal);
animation-timing-function: ease-out;
```

#### Reduced Motion

The global reduced-motion handler preserves non-motion transitions (color, opacity) while disabling animations and transforms. **DO NOT add per-component `@media (prefers-reduced-motion: reduce)` blocks** — the global handler covers all cases except component-specific animation logic (e.g., Logo cursor blink).

```css
/* Global handler in global.css — do not duplicate elsewhere */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-property: color, background-color, border-color, outline-color,
      text-decoration-color, fill, stroke, opacity, box-shadow, visibility !important;
    transition-duration: 0.2s !important;
  }
  ::view-transition-old(root), ::view-transition-new(root) {
    animation: none !important;
  }
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

### Content Collections

Two collections share a common `publishableSchema` (title, summary, tags, dates, isDraft):

- **Blog posts** in `src/content/blog/[slug]/index.md` or `.mdx` — extends the shared schema with `author` and `image` fields
- **Apps** in `src/content/apps/[slug]/` — metadata (`index.md`), app component (`App.astro`), and source code (`.ts` modules) all co-located. The page in `src/pages/apps/[slug].astro` is a thin routing stub that imports `AppShell` + the app component.
- Schema in `src/content/config.ts` — Zod-validated with transforms
- `isDraft: true` by default — set `isDraft: false` to publish
- `summary` must be 50–360 characters
- `date` is computed: `publicationDate ?? createdDate`
- `publicationDate` must be >= `createdDate`

### Shared Utilities

- **`getPublishedPosts()`** (`src/utils/posts.ts`) — Single source of truth for fetching published posts. Filters out drafts and sorts by date descending with slug tiebreaker for stable ordering. Use this in every page that needs blog posts — never duplicate the filter/sort logic.
- **`getPublishedApps()`** (`src/utils/apps.ts`) — Same pattern as `getPublishedPosts()` but for the apps collection.
- **`getFeedItems()`** (`src/utils/feed.ts`) — Returns a discriminated union `FeedItem = { type: "post" | "app", entry }` sorted by date descending. Used on the home page and tag pages to render a mixed chronological feed.
- **`openSearch()`** (`src/utils/search-trigger.ts`) — Dispatches a synthetic Cmd+K event to trigger the search modal. Use in any button/element that should open search.
- **`onPageReady()`** (`src/utils/lifecycle.ts`) — View Transition lifecycle manager with automatic AbortController cleanup.
- **`getReadingTime()`** (`src/utils/readingTime.ts`) — Reading time calculator (200 WPM).
- **`fuzzyMatch()`** (`src/utils/search.ts`) — Search scoring algorithm for the search modal.

### Component Conventions

- All components are `.astro` files in `src/components/`
- Two layouts: `src/layouts/Layout.astro` (blog pages) and `src/components/AppShell.astro` (app pages)
- Layout always includes: SearchModal, ScrollToTop, ThemeToggle, Analytics, FontPreload
- AppShell provides: theme flash prevention, FontPreload, ClientRouter, SearchModal, ThemeToggle, and a thin top bar with `fpl0 / apps` navigation
- Theme flash prevention: inline script in `<head>` reads localStorage before paint (both layouts)
- SearchModal uses singleton pattern — module-level state persists across navigations
- **`<PageHeader>`** — Site-wide nav bar: `fpl0_` brand link + `about / apps / tags / search`. Used by every blog Layout page (no props needed).
- **`<AppShell>`** — Standalone layout for full-viewport apps. Top bar: `fpl0 / apps` (desktop), `← [title]` (mobile). Props: `title`, `description`.
- **`<AppCard>`** — App preview card for feed listings. Visually matches PostCard but with an "app" label below the date. Uses `app-date` class with `::after` pseudo-element.
- **`<Logo>`** — Reusable brand mark with cursor animation. `as` prop controls HTML element: `"h1"` (default) or `"span"` (for nav bar context).
- **`<Caption>`** — Shared figcaption for `<Figure>` and `<Table>` components.

### Styling

- Design system in `src/styles/global.css` — CSS custom properties for everything
- Component styles split into: `prose.css`, `code-block.css`, `search-modal.css`, `table-of-contents.css`, `tables.css`, `footnotes.css`, `home.css`, `about.css`, `blog-post.css`, `print.css`, `tags.css`, `app-shell.css`, `apps.css`

### Performance

- All CSS inlined at build time (`build.inlineStylesheets: "always"`)
- Viewport-triggered link prefetching enabled
- Images in `public/` optimized to WebP via `cwebp` in prebuild (requires `cwebp` installed); Astro Image service uses Sharp at build time
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
scripts/
├── base.ts          Shared paths, helpers, frontmatter parser
├── new-post.ts      Scaffold blog post (bun run 0:new:post)
├── new-app.ts       Scaffold app (bun run 0:new:app)
├── list-content.ts  List content (bun run 0:list)
├── publish.ts       Publish by slug (bun run 0:publish <slug>)
└── delete.ts        Delete by slug (bun run 0:delete <slug>)
src/
├── components/     25 Astro components (includes Logo, Caption, AppCard, AppShell)
├── content/
│   ├── config.ts   Zod schema (shared publishableSchema for blog + apps)
│   ├── blog/       Post directories (slug/index.md|mdx)
│   └── apps/       App directories (slug/index.md + App.astro + .ts modules)
├── layouts/
│   └── Layout.astro
├── pages/
│   ├── index.astro
│   ├── about.astro
│   ├── 404.astro
│   ├── blog/[slug].astro
│   ├── apps/index.astro
│   ├── apps/[name].astro   (one static page per app)
│   ├── tags/index.astro
│   ├── tags/[tag].astro
│   ├── rss.xml.ts
│   └── search.json.ts
├── plugins/        Custom rehype plugin
├── styles/         CSS design system + component styles (14 files)
└── utils/
    ├── apps.ts            getPublishedApps() — Published app fetching
    ├── feed.ts            getFeedItems() — Mixed chronological feed
    ├── lifecycle.ts       onPageReady() — View Transition lifecycle
    ├── posts.ts           getPublishedPosts() — Published post fetching
    ├── readingTime.ts     Reading time calculator (200 WPM)
    ├── search.ts          fuzzyMatch() — Search scoring algorithm
    └── search-trigger.ts  openSearch() — Search modal trigger
```

## Common Pitfalls

- **Adding a new external resource?** Update the CSP header in `Layout.astro`
- **New interactive component?** Use `onPageReady()` and pass `signal` to all event listeners
- **New `is:inline` script?** Cannot import modules — use IIFE + guard, handle both load events
- **Blog post not showing?** Check `isDraft` — defaults to `true`
- **Summary validation failing?** Must be 50–360 characters
- **Styles not applying in dark mode?** Use CSS custom properties, never hardcoded colors
- **Want to add a dependency?** Don't — use Web APIs and Bun built-ins first, ask the user if truly needed
- **Need published posts?** Use `getPublishedPosts()` from `src/utils/posts.ts` — never duplicate the filter/sort
- **Need to open search from a button?** Use `openSearch()` from `src/utils/search-trigger.ts`
- **Need a figcaption?** Use the `<Caption>` component — never duplicate the label/caption pattern
- **Need published apps?** Use `getPublishedApps()` from `src/utils/apps.ts`
- **Need a mixed feed?** Use `getFeedItems()` from `src/utils/feed.ts`
- **Hardcoded color/font/spacing/z-index/radius/duration?** Use design tokens — `bun run lint:design` will catch it. Exempt with `/* token-exempt */`
