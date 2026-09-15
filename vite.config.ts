import { defineConfig } from 'vite';

// GOAL-004: relative base so the production build works both at a domain
// root and under a sub-path (e.g. GitHub Pages project sites:
// https://<user>.github.io/<repo>/), without any code changes.
export default defineConfig({
  base: './',
});
