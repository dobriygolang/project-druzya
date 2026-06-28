/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  readonly VITE_GO_LSP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
