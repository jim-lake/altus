import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import a11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import noBoundFunctions from './scripts/no-bound-functions.mjs';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  // Global ignores must be first and separate
  {
    ignores: [
      '**/node_modules/**',
      'node_modules/**',
      'vendor/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'macos/**',
      '.expo/**',
      'metro-cache/**',
      '*.bundle.js',
      '*.bundle.js.map',
    ],
  },
  // Apply recommended config only to source files
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', '*.{js,jsx,ts,tsx}'],
    ...js.configs.recommended,
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', '*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
        __DEV__: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        XMLHttpRequest: 'readonly',
        // React Native specific globals
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      local: { rules: { 'no-bound-functions': noBoundFunctions } },
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      import: importPlugin,
      'jsx-a11y': a11y,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
      'import/ignore': ['node_modules', '\\.(css|less|scss|sass|styl)$'],
    },
    rules: {
      'local/no-bound-functions': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'no-unreachable': 'error',
      'no-unused-expressions': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-implicit-globals': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-proto': 'error',
      'no-script-url': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      radix: 'error',
      yoda: 'error',

      // React rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react/jsx-uses-react': 'off', // Not needed with new JSX transform
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
      'react/prop-types': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unescaped-entities': 'error',
      'react/no-unknown-property': 'error',
      'react/require-render-return': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-closing-bracket-location': 'error',
      'react/jsx-closing-tag-location': 'error',
      'react/jsx-curly-spacing': ['error', 'never'],
      'react/jsx-equals-spacing': ['error', 'never'],
      'react/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
      'react/jsx-indent': ['error', 2],
      'react/jsx-indent-props': ['error', 2],
      'react/jsx-max-props-per-line': [
        'error',
        { maximum: 1, when: 'multiline' },
      ],
      'react/jsx-no-bind': [
        'error',
        { allowArrowFunctions: true, allowFunctions: false, allowBind: false },
      ],
      'react/jsx-no-literals': 'off', // Can be too strict for RN
      'react/jsx-pascal-case': 'error',
      'react/jsx-tag-spacing': [
        'error',
        { closingSlash: 'never', beforeSelfClosing: 'always' },
      ],
      'react/jsx-wrap-multilines': [
        'error',
        {
          declaration: 'parens-new-line',
          assignment: 'parens-new-line',
          return: 'parens-new-line',
          arrow: 'parens-new-line',
          condition: 'parens-new-line',
          logical: 'parens-new-line',
        },
      ],

      // React Hooks rules
      ...reactHooks.configs.recommended.rules,

      // React Native specific rules
      'react-native/no-unused-styles': 'off',
      'react-native/split-platform-components': 'error',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'off',
      'react-native/no-raw-text': ['error', { skip: ['CustomText', 'Text'] }],
      'react-native/sort-styles': 'warn',

      // Import rules
      'import/order': 'off',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Node builtins.
            [
              '^node:',
              `^(assert|buffer|child_process|cluster|crypto|dgram|dns|events|fs|http|https|net|os|path|stream|timers|tls|tty|url|util|zlib)(/|$)`,
            ],

            // React then packages.
            ['^react$', '^react', '^@?\\w'],

            // Internal aliases.
            ['^@/'],

            // Parent imports.
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],

            // Sibling imports.
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],

            // Type imports LAST.
            ['^.+\\u0000$'],
          ],
        },
      ],

      'simple-import-sort/exports': 'off',
      'import/no-duplicates': 'error',
      'import/no-useless-path-segments': 'error',
      'import/no-cycle': 'error',
      'import/prefer-default-export': 'off',
      // Disable these rules that cause parser issues with React Native
      'import/named': 'off',
      'import/default': 'off',
      'import/namespace': 'off',

      // JSX Accessibility rules (adapted for React Native)
      'jsx-a11y/accessible-emoji': 'off', // Not applicable to RN
      'jsx-a11y/alt-text': 'off', // Different requirements in RN
      'jsx-a11y/anchor-has-content': 'off', // No anchors in RN
      'jsx-a11y/anchor-is-valid': 'off', // No anchors in RN
      'jsx-a11y/aria-activedescendant-has-tabindex': 'off', // Limited ARIA support in RN
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/heading-has-content': 'off', // No semantic headings in RN
      'jsx-a11y/iframe-has-title': 'off', // No iframes in RN
      'jsx-a11y/img-redundant-alt': 'off', // Different image handling in RN
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-distracting-elements': 'off', // No marquee/blink in RN
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
    },
  },

  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      // Disable base rules that are handled by TypeScript
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/method-signature-style': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-function-type': 'error',

      // React TypeScript specific
      'react/prop-types': 'off', // TypeScript handles this
    },
  },

  // Test files configuration
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
    languageOptions: {
      globals: {
        ...globals.jest,
        detox: 'readonly',
        device: 'readonly',
        element: 'readonly',
        by: 'readonly',
        waitFor: 'readonly',
      },
    },
    rules: {
      // Relax some rules for tests
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },

  // Configuration files
  {
    files: [
      '*.config.js',
      '*.config.ts',
      'babel.config.*',
      'metro.config.*',
      'jest.config.*',
      'detox.config.*',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
];
