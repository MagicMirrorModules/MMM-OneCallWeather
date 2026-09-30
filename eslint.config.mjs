import css from '@eslint/css'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import { flatConfigs as importX } from 'eslint-plugin-import-x'
import js from '@eslint/js'
import markdown from '@eslint/markdown'
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
  { files: ['**/*.css'], languageOptions: { tolerant: true }, plugins: { css }, language: 'css/css', extends: ['css/recommended'], rules: { 'css/use-baseline': ['error', { available: 'newly' }] } },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        Log: 'readonly',
        Module: 'readonly',
        WeatherObject: 'readonly',
        config: 'readonly',
      },
    },
    extends: [importX.recommended, js.configs.recommended, stylistic.configs.recommended],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    extends: [importX.recommended, js.configs.recommended, stylistic.configs.recommended],
  },
  { files: ['demo.config.js'], rules: { 'prefer-const': 'off' } },
  { files: ['**/*.md'], plugins: { markdown }, extends: ['markdown/recommended'], language: 'markdown/gfm' },
])
