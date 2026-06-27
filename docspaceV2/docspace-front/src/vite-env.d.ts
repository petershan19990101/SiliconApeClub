/**
 * vite-env.d 相关文件，用于承载对应模块的实现。
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DATA_MODE?: string;
  /** 与构建模式一致：sit / uat / sandbox（可选，便于界面展示） */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
