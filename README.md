# Interview Bot

An AI interview coach (built with **Vite** + vanilla JS) that helps you prepare for AI roles:

1. **AI Product Manager**
2. **Forward Deployed Engineer**
3. **AI Researcher**

Search the role you're interviewing for — the app validates it (aliases like "AI PM", "FDE" or "Research Scientist" work, typos are tolerated, unsupported roles get a "did you mean…?" hint). Every response is then contextualized to that role's interview loop, and the chat UI shifts to a subtly different accent color per role.

## Features

- Role search with autocomplete, keyboard navigation and validation
- Role-specific system prompts (interview loop, competencies, what strong candidates show)
- Starter prompts per role, mock-interview mode with feedback and scoring
- Separate conversation per role (switching back restores it)
- Streaming responses rendered as sanitized Markdown, with a stop button
- White → grey gradient background with a grid overlay; role-tinted accent that animates on switch
- Bring-your-own Gemini API key, verified before use

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL and paste your Gemini API key (get one at <https://aistudio.google.com/apikey>).

```bash
npm run build && npm run preview
```

## Configuration

The model defaults to `gemini-3.8-flash`. To override it, set `VITE_GEMINI_MODEL` in a `.env` file:

```
VITE_GEMINI_MODEL=gemini-3.8-flash
```

## API key & privacy

The key is entered in the browser and sent only to `generativelanguage.googleapis.com` (via the `x-goog-api-key` header). It is kept in `sessionStorage` for the tab, and in `localStorage` only if "Remember on this device" is checked. Use **Remove key** in the key dialog to clear it. Because this is a client-only app, don't deploy it with a shared key baked in.

## Project structure

```
index.html
src/
  main.js     UI: search, views, chat, key dialog
  roles.js    role definitions, aliases, validation
  gemini.js   Gemini REST client (SSE streaming) + system prompt
  style.css   styles and role theming
```
