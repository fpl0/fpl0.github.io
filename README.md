# fpl0.blog

My personal blog.

## Writer's Style Guide

All content is managed in `src/content/blog/` using `.md` or `.mdx` files. MDX supports standard Markdown and lets you import components for figures, tables, videos, and more.

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

### Collapsible Sections

```markdown
<details>
<summary>Click to expand</summary>

Hidden content here...

</details>
```

## Visual Identity

The design uses a warm, dark palette of walnut and cream to support long-form technical reading. A classical serif handles the headings while a clean sans-serif covers the body text, all balanced on a Minor Third scale for a quiet, archival feel.

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
