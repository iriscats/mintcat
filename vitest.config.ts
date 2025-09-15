/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,        // 允许直接使用 describe/it/expect
    environment: 'node',  // 使用 node 环境以支持 sql.js
    // 设置测试环境变量
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
    },
    // 测试超时设置
    testTimeout: 10000,
    // 设置测试文件匹配模式
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // 排除不需要测试的文件
    exclude: ['node_modules', 'dist', 'src-tauri'],
  },
})