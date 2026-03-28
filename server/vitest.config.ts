/**
 * Vitest 配置 — 服务端
 * 与 tsconfig.json 同级，ts-node 读取 tsconfig 进行类型解析。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/utils/**/*.ts']
    }
  }
})
