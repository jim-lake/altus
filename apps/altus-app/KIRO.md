# KIRO.md — altus-app

## Overview

React Native macOS app. Uses Hermes engine, New Architecture (Fabric), and the new JSX transform. Node >= 24.

## Project Structure

```
src/
├── app.tsx              # Root component, startup logic
├── home_screen.tsx      # Top-level screens live at src root
├── login_screen.tsx
├── components/          # Reusable UI components
│   ├── theme_style.ts   # CSS-variable-like theming system
│   └── buttons/         # Grouped by domain
├── stores/              # Global state modules (EventEmitter + useSyncExternalStore)
├── lib/                 # Domain logic, API clients (auth, xcloud_api)
├── theme/               # Color definitions (light/dark scheme variables)
└── tools/               # Pure utilities (api, retry, herd, storage, log, etc.)
```

## Code Conventions

### Naming
- Files: `snake_case.ts` / `snake_case.tsx`
- Components: `PascalCase` function name, `snake_case` file
- Private module globals: `g_` prefix (e.g. `g_accessToken`, `g_eventEmitter`)
- Private functions: `_` prefix (e.g. `_emit`, `_save`, `_verifyToken`)
- Constants at module level: `UPPER_SNAKE_CASE` (e.g. `TOKEN_KEY`, `CHANGE_EVENT`)

### Functions
- **Use function declarations, not arrow/const bindings** — enforced by custom ESLint rule `local/no-bound-functions`
- Exception: inline arrow callbacks passed to JSX props or `.map()` are fine
- Exported hooks use the `use` prefix: `useIsReady`, `useList`, `useLatestCallback`

### Module Pattern (Stores)
Stores export a default object with the public API and also export individual named functions:
```ts
export default { init, addListener, startLogin, logout, get, post, ... };
export function init() { ... }
export function useIsReady() { ... }
```
State is held in module-level `let` variables. Change notification via `EventEmitter` + `useSyncExternalStore`.

### Imports
- Path aliases: `@/` maps to `src/` (via babel module-resolver + tsconfig paths)
- Package.json `"imports"` field also defines `#tools/*`, `#lib/*`, `#components/*`
- Import order (enforced): builtin → external → internal → parent → sibling → index → type
- Separate type imports: `import type { ... } from '...'` (enforced by `consistent-type-imports`)

### TypeScript
- Strict mode with `noUncheckedIndexedAccess`
- `moduleResolution: "bundler"`
- Interfaces over type aliases for object shapes (`consistent-type-definitions: interface`)
- No `any` — `@typescript-eslint/no-explicit-any: error`
- No non-null assertions — `@typescript-eslint/no-non-null-assertion: error`
- Prefer `??` over `||` and `?.` chains (`prefer-nullish-coalescing`, `prefer-optional-chain`)
- Prefer `readonly` on class fields (`prefer-readonly`)
- Array types: use `T[]` for simple, `Array<T>` for complex (`array-type: array-simple`)

### React / JSX
- New JSX transform — no `React` import needed for JSX (but import React when using hooks from it)
- Self-closing tags for childless elements
- JSX strings must be wrapped in `{'text'}` (react-native `no-raw-text` rule)
- One prop per line in multiline JSX
- No `.bind()` in JSX; arrow functions allowed, regular function refs allowed

### Styling
- Custom theming via `StyleSheet.create` from `@/components/theme_style` (not react-native directly)
- CSS-variable-like syntax in style values: `'var(--bg-color)'` resolved at runtime per color scheme
- Define theme variables in `src/theme/colors.ts` using `setVariables` / `setSchemeVariables`
- Prefer `useStyles(styles)` hook to get scheme-resolved styles

### Error Handling
- API responses use `{ err, body, text, headers, statusCode }` result pattern (no thrown errors from api module)
- Consumers check `result.err` before accessing `result.body`
- Async utilities: `retry` with exponential backoff, `herd` for deduplication, `herdOnce` for one-shot init

## Lint Rules (Key)

### General
- `eqeqeq: always` — no `==` / `!=`
- `curly: all` — always use braces
- `prefer-const` — no `let` when not reassigned
- `no-var` — never use `var`
- `no-eval`, `no-implied-eval`, `no-new-func` — no dynamic code

### TypeScript (strict)
- `no-floating-promises` — all promises must be awaited or voided
- `no-misused-promises` — no promises in boolean positions
- `no-unsafe-assignment/call/member-access/return` — no untyped `any` flow
- `restrict-template-expressions` — only strings/numbers in templates
- `require-await` — async functions must contain await

### React Native
- `react-native/no-raw-text` — wrap text in `{'...'}`; allowed in `<Text>` and `<CustomText>`
- `react-native/sort-styles` — warn on unsorted StyleSheet keys
- `react-native/no-inline-styles` — warn (prefer StyleSheet)

### Imports
- `import/no-cycle` — no circular dependencies
- `import/order` — grouped & alphabetized
- `import/no-duplicates` — no duplicate import sources

## Prettier

```js
trailingComma: "es5"
singleQuote: true
jsxSingleQuote: true
tabWidth: 2
objectWrap: "collapse"
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint with auto-fix |
| `npm run pretty` | Prettier format |
| `npm run ts:check` | TypeScript type check (no emit) |
| `npm test` | Unit tests via `tsx --test` |
| `npm run mac` | Run on macOS |

## Testing

- Runner: Node's built-in test runner via `npx tsx --test tests/unit/*.test.ts`
- Test files: `tests/unit/<name>.test.ts`
- Relaxed lint rules in test files (any/non-null-assertion allowed)
