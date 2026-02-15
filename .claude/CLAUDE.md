# CLAUDE.md — fpl0.blog

## Strict Rules (Always Follow)

1. **NEVER use emojis.** Use SVGs or CSS shapes instead.
2. **NEVER use pure white or pure black.** No `#FFFFFF`, `#000000`, `white`, or `black` — always use the warm palette OKLCH tokens.
3. **NEVER add arbitrary font sizes.** Use the mathematically derived type scale from `global.css`.
4. **NEVER add borders without `--ui-border` or `--ui-inset-border`.** No hardcoded border properties.
5. **NEVER add shadows without `var(--shadow-*)`.** Use `--ui-shadow` or `--ui-inset` for material depth.
6. **NEVER use `hsl()`, `rgb()`, or hex colors in CSS.** Use `oklch()` via design tokens or directly for unique cases (e.g. gradients).
7. **ALWAYS use `var(--font-serif)` for headings and prose.**
8. **ALWAYS use `var(--font-mono-brand)` for metadata, dates, and system labels.**
9. **ALWAYS use the `<Link>` component.** Never use bare `<a>` tags for internal or external links.
10. **ALWAYS use smooth transitions (0.2s minimum) with physical easing.** Use `--spring-stiff`, `--spring-bouncy`, or `--ease-out`.
11. **ALWAYS include `prefers-reduced-motion: reduce`** (handled globally in `global.css`).
12. **Consistency**: All styles (colors, links, animations) must be derived from the Geometric Engine in `global.css`.
13. **Modularity**: Break down complex UI into focused Astro components (e.g. `EntryCard`, `BaseHead`).
14. **Token Compliance**: Run `bun run lint:design` to catch violations. Add `/* token-exempt */` only for truly unique values.

## Stack

- **Astro 5.17+** with MDX, View Transitions (`ClientRouter`), static output
- **TypeScript** / JavaScript (ESNext), strict mode
- **Bun** runtime and package manager (strictly enforced)
- **Biome** for linting and formatting (`bun run lint` / `bun run format`)
- **Fonts**: `@fontsource` packages with `font-display: block` and metric-override fallbacks
- **Syntax highlighting**: Shiki with CSS variables, dual themes (OKLCH-compatible)

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
| Scaffold a blog post | `bun run 0:new:post` |
| Scaffold an app | `bun run 0:new:app` |
| List all content | `bun run 0:list` (`--drafts` / `--published`) |
| Publish by slug | `bun run 0:publish <slug>` |

## Code Quality

- **Clean & Concise**: Write minimal, efficient code.
- **DRY**: Extract common logic into `src/utils/content.ts`. Use `getFeedItems()` for the mixed feed. Render entries using the unified `EntryCard.astro`.
- **Layout Logic**: Use `<BaseHead>` in all layouts to share theme init, fonts, and meta logic.
- **CSS**: Targeted, token-driven, and responsive. Use **Container Queries** (`cqi`) for component-level responsiveness.

---

## Design System — "The Digital Antiquarian"

This is the **mathematical single source of truth**. Every element MUST adhere to these laws.

### 1. Geometric Engine (Euclidean Axioms)

- **Modular Spacing**: Base grid `--grid: 4px`. All spacing tokens (`--space-1` to `--space-140`) are integer multiples of this grid via `calc()`.
- **Vertical Rhythm**: Established via `--baseline: 1.6rem`. Vertical margins (`--space-y-*`) snap to this baseline to lock the vertical cadence.
- **Harmonic Type Scale**: Headings derived exponentially using a strict **Minor Third (1.2)** ratio (`--font-ratio`) against the base font size.
- **Topological Fluidity**: Components like `EntryCard` use **Container Query units (`cqi`)** to maintain proportions relative to their local context.

### 2. Physical Dynamics (Newtonian Kinematics)

- **Spring Physics**: Transitions use mass-spring-damping approximations: `--spring-stiff` (snappy), `--spring-bouncy` (elastic), `--spring-soft` (smooth).
- **Interaction Hysteresis**: Asymmetrical hover states. Transition **IN** is fast (`--duration-in: 0.15s`), transition **OUT** is normal (`--duration-out: 0.2s`), mimicking physical inertia.
- **Inertial Drift**: Microscopic `translateY(-1px)` on link hover to signal "lifting" from the substrate.
- **Invisible Reach**: Hit-box expansion via `::after` on `<Link>` (expanded by `8px` per Fitts's Law).

### 3. Materiality (Ecological Light Physics)

- **Perceptual Field (OKLCH)**: Entire color system uses the OKLCH space for perceptual luminance orchestration.
- **Entropy Synthesis**: Procedural SVG grain (`feTurbulence`) applied as a fixed overlay (`html::before`) to provide typographic "tooth."
- **Chromatic Elevation**: Shadows derived from the master hue (`--hue`) to simulate real-world light occlusion on parchment.
- **Material Inset**: Inset shadows (`--ui-inset`) and microscopic borders make media feel "embedded" into the substrate.
- **Soft Focus Attention**: Body content blurs and recedes (`filter: blur(...) grayscale(...)`) when modals (Search, Lightbox) are active.

### Typography

#### Font Stacks

| Variable | Font | Usage |
|----------|------|-------|
| `--font-sans` | `Inter Variable` | UI, navigation, summaries |
| `--font-serif` | `Merriweather` | **Primary reading**: headings, article prose |
| `--font-mono-brand` | `Space Mono` | Metadata, system labels, numeric data |
| `--font-mono` | `JetBrains Mono` | Code blocks, technical syntax |

#### OpenType Orchestration

Root `--font-settings` enforces `cv05` (disambiguated L), `kern`, `liga`, and `tnum` (tabular numbers) for mathematical alignment.

#### Line Heights (Tschichold Inverse Scale)

Line heights are inversely proportional to font size: `--line-height-tight` (1.1) for H1, up to `--line-height-loose` (1.7) for long prose.

---

## Architecture Rules

### Unified Shell Logic

All pages must utilize the `<BaseHead>` component to ensure consistent:
1. **Theme Flash Prevention**: Critical inline script reading `localStorage`.
2. **Font Preloading**: `font-display: block` for zero-flicker rendering.
3. **CSP Headers**: Standardized security policy.
4. **View Transitions**: Shared `ClientRouter` behavior.

### Interaction States

Orchestrate the following root-level classes for global state transitions:
- `.is-searching`: Content blurs and recedes for the search ledger.

### Content Logic

Single source of truth in `src/utils/content.ts`:
- `getPublishedPosts()`: Filtered/Sorted blog posts.
- `getPublishedApps()`: Filtered/Sorted apps.
- `getFeedItems()`: Unified chronological feed.
- `getReadingTime(content)`: Estimator (200 WPM).

## Common Pitfalls

- **Bare <a> tags**: Breaks Hit-Box Expansion and physical hysteresis. Always use `<Link>`.
- **HSL/Hex in CSS**: Violates perceptual field logic. Use tokens or OKLCH.
- **Duplicate Logic**: Never rewrite post/app fetching or sorting. Use `content.ts`.
- **Missing @breakpoint comment**: Linter will fail without `/* @breakpoint-mobile */`.
- **Viewport Units in Components**: Prefers `cqi` for topological stability.
- **Hardcoded borders/radii**: Violates the Semantic Abstraction Layer. Use `--ui-*` tokens.
