# Repository Guidelines

# Development Process
You will follow a test driven development framework. The workflow for new features
should be organized as follows.
- Develop a plan, with a step by step to-do list of each of the things that will be developed
- from there, write tests that measure the accomplishment of this task
- then, begin writing code, adjusting until the tests pass
- repeat

## Project Structure & Module Organization
- `src/` contains the React 19 + TypeScript SPA; `main.tsx` bootstraps Vite and `App.tsx` defines routing.
- Feature views live in `src/pages/`, shared UI in `src/components/`, and API helpers in `src/api/`.
- Static assets sit under `public/` and `src/assets/`; adjust `vite.config.ts` if you add new roots.
- The FastAPI backend lives in `backend/`; `backend/main.py` exposes the service and `backend/database/` hosts SQL bootstraps.
- Experimental ConstructIQ notebooks and sample documents are in `backend/doc-iq/`; keep large artifacts out of Git.

## Build, Test, and Development Commands
- `npm run dev` launches the Vite dev server at `http://localhost:5173` with hot reloading.
- `npm run build` performs a TypeScript project build then emits production assets to `dist/`.
- `npm run lint` runs ESLint with the shared React/TS config; fix warnings before opening a PR.
- Backend: create an env (`python -m venv .venv && source .venv/bin/activate`), install deps (`pip install -r backend/requirements.txt`), then run `uvicorn main:app --reload` from `backend/`.

## Coding Style & Naming Conventions
- Follow the ESLint and TypeScript presets in `eslint.config.js`; use 2-space indentation and double-quoted strings in JSX/TSX.
- Keep React components and hooks typed explicitly; favor PascalCase for components, camelCase for functions and variables.
- Co-locate styles with components (`App.css`, page-specific CSS) and avoid global selectors unless updating `index.css`.
- When adding API wrappers in `src/api/`, expose typed functions matching backend route names for consistency.

## Testing Guidelines
- Automated tests are not yet configured; run `npm run lint` and perform smoke checks in `npm run dev` before submitting.
- For backend changes, add targeted FastAPI dependency tests with `pytest` in `backend/tests/` (create as needed) and document manual scenarios.
- Capture coverage expectations in the PR description until a formal test suite is introduced.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative-lowercase messages (e.g., `new project modal fix`); follow that pattern and group related changes.
- Reference tickets or context in the body when relevant, and mention any config updates.
- PRs should include: summary of changes, steps to reproduce/test, UI screenshots for visual updates, and notes on env variables or migrations.
- Confirm frontend lint/build and backend server startup in the PR checklist; link Supabase SQL files if schema changes.

## Security & Configuration Tips
- Never commit secrets; store Supabase keys in `backend/.env` and front-end keys prefixed `VITE_` in a local `.env`.
- Keep `backend/database/` SQL scripts in sync with production; document migration order in the PR when adding new files.
- Ensure Ollama models or large embeddings are downloaded locally and ignored via `.gitignore`.
