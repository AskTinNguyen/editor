import { describe, expect, test } from 'bun:test'
import { getTrustedAssetRemotePatterns } from './assets-cdn'

describe('getTrustedAssetRemotePatterns', () => {
  test('falls back to the production CDN when no custom asset origin is configured', () => {
    expect(getTrustedAssetRemotePatterns(undefined)).toEqual([
      {
        protocol: 'https',
        hostname: 'editor.pascal.app',
        port: '',
      },
    ])
  })

  test('uses only the configured asset host when a valid CDN origin is provided', () => {
    expect(getTrustedAssetRemotePatterns('https://cdn.pascal.app/assets')).toEqual([
      {
        protocol: 'https',
        hostname: 'cdn.pascal.app',
        port: '',
      },
    ])
  })

  test('keeps localhost ports explicit for local asset development', () => {
    expect(getTrustedAssetRemotePatterns('http://localhost:3005')).toEqual([
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3005',
      },
    ])
  })
})
