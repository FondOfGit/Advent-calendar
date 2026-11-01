# An Advent of Christmas Curiosities

A Victorian-styled Advent calendar of Christmas trivia. It has 24 doors, one per day from 1 to 24 December, and each opens a multiple-choice question with an explanation. It is plain HTML, CSS and JavaScript, deployed to GitHub Pages.

- Run locally: `python3 -m http.server 8000`, then open <http://localhost:8000/?preview=1>
- Edit questions: `questions.json`, then run `node scripts/validate-questions.mjs`
- Add card art: `images/cards/`, then set `image`, `imageAlt` and `imageCredit` for that day

See [CLAUDE.md](CLAUDE.md) for the full details on the stack, testing flags, storage and deployment.
