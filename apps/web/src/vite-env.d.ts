/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  readonly VITE_GO_LSP?: string
  readonly VITE_HONE_DOWNLOAD_MAC?: string
  readonly VITE_HONE_DOWNLOAD_WIN?: string
  readonly VITE_HONE_HERO_VIDEO?: string
  readonly VITE_HONE_HERO_POSTER?: string
  readonly VITE_SITE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
