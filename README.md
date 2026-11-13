# skills

Skills for [Claude Code](https://docs.claude.com/en/docs/claude-code/skills). Each folder under `skills/` is one skill: a `SKILL.md` with the instructions, plus the scripts and templates it uses.

| Skill | What it does |
|---|---|
| [recorded-ui-demo](skills/recorded-ui-demo) | Makes a demo video of a web app running on your machine. It records one scripted run of the real app in Playwright at 2× resolution, then edits it in Remotion with the whole page in view, brief zooms only on small details, a drawn cursor, captions under the page, and title and recap cards. Needs Node 18+, ffmpeg and Python 3. |

## Install

With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add WeismannS/skills                                                  # choose skills and agents
npx skills add WeismannS/skills --skill recorded-ui-demo -g -a claude-code -y    # every project, Claude Code
```

Without `-g` the skill goes into the current project. Other agents the CLI supports work too, as long as they can run shell commands and read images.

Or by hand: copy a skill's folder into `~/.claude/skills/` to use it in every project, or into `<project>/.claude/skills/` for one project:

```bash
git clone https://github.com/WeismannS/skills.git
cp -r skills/skills/recorded-ui-demo ~/.claude/skills/
```

Claude Code loads it in the next session. Then ask in plain words, for example "make a demo video of the app on localhost:5173"; you don't need to name the skill.

## License

MIT. See [LICENSE](LICENSE).
