/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** FastAPI base URL — see .env.example */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
