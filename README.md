# Newsletter Template Structure

## Overview

The SARJAN newsletter uses a **two-file system** to prevent template corruption during content generation:

1. **`template.html`** - The master template (never modified)
2. **`index.html`** - The generated newsletter (updated daily)

## File Purposes

### template.html (Master Template)
- **Purpose**: Base template with all design elements
- **Contains**: 
  - PHRACK-inspired styling
  - Particle network background
  - Header with personal branding
  - Empty placeholders for dynamic content
  - Footer
- **Modified**: Only when updating the design
- **Used by**: Newsletter generation code reads this file

### index.html (Generated Newsletter)
- **Purpose**: Daily newsletter with actual content
- **Contains**: 
  - All elements from template.html
  - LLM-generated greeting
  - Categorized articles with commentary
  - Current timestamp
- **Modified**: Automatically by newsletter generation
- **Used by**: Published to GitHub Pages

## How It Works

```
1. Newsletter Generation Triggered
   ↓
2. Read template.html (base design)
   ↓
3. Generate content (LLM commentary, articles)
   ↓
4. Inject content into template
   ↓
5. Write to index.html (overwrites old newsletter)
   ↓
6. Archive old index.html (if exists)
```

## Important Notes

⚠️ **DO NOT** manually edit `index.html` - your changes will be overwritten!

✅ **DO** edit `template.html` when updating the design

✅ **DO** commit both files to git:
- `template.html` - tracks design changes
- `index.html` - shows current newsletter (for GitHub Pages)

## Editing the Template

To update the newsletter design:

```bash
# 1. Edit the master template
vim pwnspectrum-rss/template.html

# 2. Test your changes
open pwnspectrum-rss/template.html

# 3. Regenerate the newsletter to apply changes
curl http://localhost:8080/newsletter

# 4. Commit both files
git add pwnspectrum-rss/template.html pwnspectrum-rss/index.html
git commit -m "Updated newsletter design"
```

## Content Injection Points

The template has two main injection points:

### 1. Greeting Section
```html
<div class="greeting" id="greeting">
    <!-- LLM-generated greeting injected here -->
</div>
```

### 2. Newsletter Content
```html
<div id="newsletter-content">
    <!-- Categorized articles with commentary injected here -->
</div>
```

### 3. Timestamp
```html
<span id="timestamp"></span>
<!-- Current date/time injected here via JavaScript -->
```

## Design Features

- **Particle Network Background**: Animated canvas with green particles
- **PHRACK Aesthetic**: Monospace font, black/green theme
- **Personal Branding**: Anmol Singh Yadav (@IamLucif3r)
- **Category Hex Numbering**: [0x01], [0x02], etc.
- **Continuous Article Flow**: No spacing between articles in same category
- **Mobile Responsive**: Adapts to different screen sizes
- **No Emojis**: Clean, professional look

## Troubleshooting

**Q: My template changes aren't showing up**
- Make sure you edited `template.html`, not `index.html`
- Regenerate the newsletter to apply changes

**Q: The template got overwritten with old content**
- This shouldn't happen anymore with the two-file system
- If it does, restore from git: `git checkout pwnspectrum-rss/template.html`

**Q: I want to preview my template changes**
- Open `template.html` directly in your browser
- Note: Dynamic content won't show (greeting, articles)
- For full preview, regenerate the newsletter

## Git Workflow

```bash
# Template is the source of truth
git add pwnspectrum-rss/template.html

# Index.html is generated but should be committed for GitHub Pages
git add pwnspectrum-rss/index.html

# Archive is gitignored (too many files)
echo "pwnspectrum-rss/archive/" >> .gitignore
```
