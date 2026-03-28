# 719 Marketplace

Private plugin marketplace for the 719 org. Contains plugins, skills, and tools for use with [Cowork](https://claude.com/product/cowork) and Claude Code.

---

## Adding this marketplace

```bash
claude plugin marketplace add 719media/claude-desktop-github-extension
```

Or add it permanently via your `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-desktop-github-extension": {
      "source": {
        "source": "github",
        "repo": "719media/claude-desktop-github-extension"
      }
    }
  }
}
```

## Adding a new plugin

Plugins can be hosted directly in this repo (under `plugins/`) or referenced from an external repo.

### Option A — Hosted in this repo

1. Create your plugin directory under `plugins/my-plugin/`
2. Add `plugins/my-plugin/.claude-plugin/plugin.json`
3. Add your `skills/`, `commands/`, etc.
4. Register it in `.claude-plugin/marketplace.json` with `"source": "./plugins/my-plugin"`

### Option B — External repo

Add an entry to `.claude-plugin/marketplace.json` pointing to the external repo:

```json
{
  "name": "my-plugin",
  "source": {
    "source": "github",
    "repo": "scratchpad-ai/my-plugin-repo",
    "ref": "main"
  }
}
```

---

## Plugin structure reference

```
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest (required)
├── skills/
│   └── my-skill/
│       └── SKILL.md       # Auto-triggered domain knowledge
├── commands/
│   └── my-command.md      # Slash commands (/my-command)
└── README.md
```

### plugin.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": { "name": "Your Name", "email": "you@example.com" }
}
```

### SKILL.md frontmatter

```markdown
---
name: my-skill
description: One-line description — used to decide when to auto-trigger this skill
---

# Skill content here
```

### Command file frontmatter

```markdown
---
description: One-line description of what this command does
---

# Command instructions here
```
