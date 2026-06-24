import type { ClientApi } from '@shared/preload-api'

declare global {
  interface Window {
    api: ClientApi
  }
}

export {}
