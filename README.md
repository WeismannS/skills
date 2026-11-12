# skills

Skills for [Claude Code](https://docs.claude.com/en/docs/claude-code/skills). Each folder under `skills/` is one skill: a `SKILL.md` with the instructions, plus the scripts and templates it uses.

| Skill | What it does |
|---|---|
| [recorded-ui-demo](skills/recorded-ui-demo) | Makes a demo video of a web app running on your machine. It records one scripted run of the real app in Playwright at 2× resolution, then edits it in Remotion with zooms, a drawn cursor, captions, and title and recap cards. Needs Node 18+, ffmpeg and Python 3. |

## Install

Copy a skill's folder into `~/.claude/skills/` to use it in every project, or into `<project>/.claude/skills/` for one project:

```bash
git clone https://github.com/WeismannS/skills.git
cp -r skills/skills/recorded-ui-demo ~/.claude/skills/
```

Claude Code loads it in the next session. Then ask in plain words, for example "make a demo video of the app on localhost:5173"; you don't need to name the skill.

## License

MIT. The cursor component in recorded-ui-demo is adapted from Digital Samba's [claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit), also MIT; its notice is kept in the file.
