# fpl0.blog

My personal blog.

## Writer's Style Guide

Content lives in two collections: **blog posts** in `src/content/blog/` and **apps** in `src/content/apps/`. Blog posts use `.md` or `.mdx` files. MDX supports standard Markdown and lets you import components for figures, tables, videos, and more.

### Headings

```markdown
## Major Section (H2)
### Subsection (H3)
```

### Body Text

Standard paragraph text. Use bold for emphasis, italic for voice, and code for technical terms.

```markdown
This is a paragraph with **bold text**, *italic text*, and `inline code`.
```

### Blockquotes

```markdown
> "A quote with proper attribution."
>
> <cite>Author Name</cite>
```

### Code Blocks

````markdown
```python
def example():
    return 42
```
````
Code blocks support syntax highlighting, copy buttons, and language labels.

### Figures and Captions

Use the `<Figure>` component in `.mdx` files. The `label` prop renders as a styled heading automatically.

```mdx
import Figure from "../../../components/Figure.astro";

<Figure
  src="https://example.com/photo.jpg"
  alt="Description of the image"
  label="Figure 1:"
  caption="Caption text here."
/>
```

| Prop | Required | Description |
| :--- | :---: | :--- |
| `src` | Yes | Image URL |
| `alt` | Yes | Alt text for accessibility |
| `label` | No | Styled label (e.g. "Figure 1:") |
| `caption` | No | Caption text (supports HTML) |

### Tables

Use the `<Table>` component in `.mdx` files. Wrap a standard Markdown table with the component.

```mdx
import Table from "../../../components/Table.astro";

<Table label="Table 1:" caption="Description of the data.">
| Column A | Column B |
| :--- | :--- |
| foo | bar |
</Table>
```

| Prop | Required | Description |
| :--- | :---: | :--- |
| `label` | No | Styled label (e.g. "Table 1:") |
| `caption` | No | Caption text (supports HTML) |

### YouTube Videos

Use the `<LiteYouTube>` component in `.mdx` files. The video thumbnail loads immediately; the iframe only initializes on click.

```mdx
import LiteYouTube from "../../../components/LiteYouTube.astro";

<LiteYouTube videoid="dQw4w9WgXcQ" title="Video Title" />
```

| Prop | Required | Description |
| :--- | :---: | :--- |
| `videoid` | Yes | 11-character YouTube video ID |
| `title` | Yes | Video title (shown as overlay and used for accessibility) |

### Task Lists

```markdown
- [x] Completed item
- [ ] Pending item
```

### Footnotes

```markdown
This is a claim[^1].

[^1]: Source of the claim.
```

### Twitter Embeds

Use the `<TwitterCard>` component in `.mdx` files. Tweet data is fetched at build time via the syndication API.

```mdx
import TwitterCard from "../../../components/TwitterCard.astro";

<TwitterCard id="20" />
```

| Prop | Required | Description |
| :--- | :---: | :--- |
| `id` | Yes | Tweet ID (numeric string) |

### Collapsible Sections

```markdown
<details>
<summary>Click to expand</summary>

Hidden content here...

</details>
```

## Apps

Apps are standalone interactive pages hosted alongside the blog. Everything for an app lives in one directory under `src/content/apps/[slug]/`:

- `index.md` — metadata (title, summary, tags, dates, isDraft)
- `App.astro` — self-contained component (markup, scoped styles, client-side script)
- `*.ts` — source modules (simulation logic, rendering, controls)

A thin routing stub in `src/pages/apps/[slug].astro` wraps the app in `<AppShell>`. Apps appear in the mixed chronological feed on the home page alongside blog posts, distinguished by an "app" label below the date. The `/apps/` listing page shows all published apps.

### Creating a New App

1. Create the app directory with metadata: `src/content/apps/my-app/index.md`

```yaml
---
title: "My App"
summary: "A short description (50-360 characters)."
createdDate: 2026-01-15
isDraft: true
tags: ["canvas", "interactive"]
---
```

2. Create the app component: `src/content/apps/my-app/App.astro`

```astro
---
// Self-contained: markup, styles, and script all here
---

<div id="my-app"><!-- App UI --></div>

<style>
  /* Scoped styles */
</style>

<script>
  import { onPageReady } from "../../../utils/lifecycle";
  // Client-side logic
</script>
```

3. Create the thin page stub: `src/pages/apps/my-app.astro`

```astro
---
import AppShell from "../../components/AppShell.astro";
import App from "../../content/apps/my-app/App.astro";
---

<AppShell title="My App" description="A short description.">
  <App />
</AppShell>
```

4. Set `isDraft: false` in `index.md` when ready to publish.

## Visual Identity

The design uses a warm palette of walnut and cream to support long-form technical reading. A classical serif (Merriweather) handles the headings and article prose while a clean sans-serif (Inter) covers the UI elements and summaries, all balanced on a Minor Third scale for a quiet, archival feel.

## Commands

| Command | Action |
| :--- | :--- |
| `bun install` | Install dependencies |
| `bun run dev` | Start development server |
| `bun run build` | Build for production to ./dist/ |
| `bun run validate` | Type-check with astro check |
| `bun run lint` | Lint and format check (Biome) |
| `bun run format` | Auto-format code (Biome) |
| `bun run check` | Full quality gate (validate + lint) |
| `bun run preview` | Preview production build locally |
