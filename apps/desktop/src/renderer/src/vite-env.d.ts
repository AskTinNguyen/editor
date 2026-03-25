/// <reference types="vite/client" />

import type { PascalDesktopApi } from '../../shared/projects'

declare global {
  interface Window {
    pascalDesktop: PascalDesktopApi
  }
}

export {}
