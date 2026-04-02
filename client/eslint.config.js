import js from '@eslint/js'
import vueParser from 'vue-eslint-parser'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vuePlugin from 'eslint-plugin-vue'

// eslint-plugin-vue flat config keys
const VUE_RECOMMENDED = vuePlugin.configs['flat/recommended']

export default [
  // 忽略文件
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },

  // ── 通用 JavaScript ────────────────────────────────────────────────
  {
    files: ['**/*.js'],
    ...js.configs.recommended
  },

  // ── TypeScript ──────────────────────────────────────────────────────
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-empty-function': 'off',
      'no-unused-vars': 'off'
    }
  },

  // ── Vue 文件 ───────────────────────────────────────────────────────
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        extraFileExtensions: ['.vue']
      }
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': tseslint
    },
    rules: {
      // 合并推荐规则 + 项目定制
      ...(VUE_RECOMMENDED?.rules ?? {}),
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },

  // ── 全局规则 ───────────────────────────────────────────────────────
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error'
    }
  },

  // ── 测试文件宽松规则 ───────────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
]
