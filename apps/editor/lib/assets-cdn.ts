export type TrustedAssetRemotePattern = {
  protocol: 'http' | 'https'
  hostname: string
  port: string
}

const DEFAULT_ASSETS_CDN_URL = 'https://editor.pascal.app'

function parseAssetOrigin(value?: string): URL {
  if (!value) return new URL(DEFAULT_ASSETS_CDN_URL)

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return new URL(DEFAULT_ASSETS_CDN_URL)
    }
    return url
  } catch {
    return new URL(DEFAULT_ASSETS_CDN_URL)
  }
}

export function getTrustedAssetRemotePatterns(
  assetsCdnUrl = process.env.NEXT_PUBLIC_ASSETS_CDN_URL,
): TrustedAssetRemotePattern[] {
  const assetOrigin = parseAssetOrigin(assetsCdnUrl)

  return [
    {
      protocol: assetOrigin.protocol === 'http:' ? 'http' : 'https',
      hostname: assetOrigin.hostname,
      port: assetOrigin.port,
    },
  ]
}
