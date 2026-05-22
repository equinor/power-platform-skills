# Development Standards

Standards that apply to all Power Apps code app skills.

## Equinor Design System (EDS)

For Equinor internal use, generated React UI **must** prefer the Equinor Design System:

- **Packages**: Use `@equinor/eds-core-react` for components, `@equinor/eds-tokens` for design tokens (spacing, typography, color), and `@equinor/eds-icons` for iconography.
- **Install**: `npm install @equinor/eds-core-react @equinor/eds-tokens @equinor/eds-icons`
- **Theme**: Use EDS tokens for theming instead of hardcoded colors. EDS supports both light and dark modes via its token system.
- **Components**: Prefer EDS components (`Button`, `TextField`, `Table`, `Dialog`, `TopBar`, `SideSheet`, etc.) over custom or third-party UI components.
- **Typography**: Use EDS typography tokens and the `Typography` component rather than raw HTML headings or custom font styles.
- **Spacing and layout**: Use EDS spacing tokens (`spacings.comfortable`, `spacings.compact`) for consistent layout.
- **Accessibility**: EDS components are built with WCAG 2.1 AA compliance. Do not override accessibility attributes.
- **Reference**: [EDS Storybook](https://storybook.eds.equinor.com/) for component API and usage examples.

When the user explicitly requests Fluent UI, Material UI, or another design system, respect their choice but inform them that EDS is the Equinor standard for internal apps.

## Theme

- Default to EDS token-based theming (light mode unless user specifies dark)
- User can override theme preference

## Node.js

- **Node.js 22+ is required** -- `npx power-apps add-data-source` rejects Node 20 and earlier
- Check with `node --version` before starting
- If the user has multiple versions, suggest `nvm use 22`

## Build & Deploy

- **Always** run `npm run build` before `npx power-apps push` -- never skip the build step
- Verify `dist/` folder contains `index.html` and `assets/` before deploying
- When adding multiple connectors: do **NOT** deploy after each one — run `npm run build` to verify, then deploy once after all connectors are added

## TypeScript

- The template uses strict mode -- unused imports cause build failures (TS6133)
- Remove any imports you don't use before building
- Don't edit generated files in `src/generated/`
