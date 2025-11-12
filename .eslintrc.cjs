module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    'vitest-globals/env': true
  },
  extends: [
    'eslint:recommended',
    '@eslint/js/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:vitest-globals/recommended'
  ],
  ignorePatterns: [
    'dist',
    'coverage',
    'node_modules',
    '*.config.js',
    '*.config.ts',
    'playwright-report',
    'test-results'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: '18.2'
    },
    'import/resolver': {
      alias: {
        map: [
          ['@', './src'],
          ['@/components', './src/components'],
          ['@/services', './src/services'],
          ['@/stores', './src/stores'],
          ['@/lib', './src/lib']
        ],
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  plugins: [
    'react',
    'react-hooks',
    'react-refresh',
    'jsx-a11y',
    'import',
    'vitest-globals'
  ],
  rules: {
    // React specific rules
    'react/prop-types': 'off', // We use TypeScript for prop validation
    'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
    'react/jsx-uses-react': 'off', // Not needed with new JSX transform
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Accessibility rules
    'jsx-a11y/no-autofocus': 'off', // Sometimes needed for UX
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',

    // Import/Export rules
    'import/no-unresolved': 'error',
    'import/order': [
      'warn',
      {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'never',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true
        }
      }
    ],
    'import/no-duplicates': 'error',

    // General code quality rules
    'no-unused-vars': [
      'warn',
      {
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': true,
        'argsIgnorePattern': '^_'
      }
    ],
    'no-console': [
      'warn',
      {
        'allow': ['warn', 'error']
      }
    ],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Code style rules
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', 'never'],
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'comma-spacing': 'error',
    'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],

    // JSX specific rules
    'react/jsx-indent': ['error', 2],
    'react/jsx-indent-props': ['error', 2],
    'react/jsx-closing-bracket-location': 'error',
    'react/jsx-closing-tag-location': 'error',
    'react/jsx-tag-spacing': 'error',
    'react/jsx-curly-spacing': ['error', 'never'],
    'react/jsx-boolean-value': ['error', 'never'],
    'react/jsx-wrap-multilines': [
      'error',
      {
        'declaration': 'parens-new-line',
        'assignment': 'parens-new-line',
        'return': 'parens-new-line',
        'arrow': 'parens-new-line',
        'condition': 'parens-new-line',
        'logical': 'parens-new-line',
        'prop': 'parens-new-line'
      }
    ],

    // Performance rules
    'react/jsx-no-bind': [
      'warn',
      {
        'ignoreDOMComponents': true,
        'ignoreRefs': true,
        'allowArrowFunctions': true,
        'allowFunctions': false,
        'allowBind': false
      }
    ]
  },
  overrides: [
    // Test files
    {
      files: ['**/*.test.{js,jsx}', '**/*.spec.{js,jsx}', '**/test/**/*.{js,jsx}'],
      env: {
        jest: true,
        'vitest-globals/env': true
      },
      rules: {
        'no-console': 'off',
        'react/display-name': 'off'
      }
    },
    // E2E test files
    {
      files: ['e2e/**/*.{js,ts}'],
      env: {
        node: true
      },
      rules: {
        'import/no-unresolved': 'off' // Playwright imports might not resolve
      }
    },
    // Configuration files
    {
      files: ['*.config.{js,ts}', '.eslintrc.js'],
      env: {
        node: true
      },
      rules: {
        'no-console': 'off',
        'import/no-unresolved': 'off'
      }
    },
    // Server files
    {
      files: ['server/**/*.{js,ts}'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-console': 'off',
        'import/no-unresolved': 'off'
      }
    }
  ]
}