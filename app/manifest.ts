import type { MetadataRoute } from 'next'

// Lets students add Conexxa to their home screen so it opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Conexxa',
    short_name: 'Conexxa',
    description: 'Send a secret crush to someone at your school.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#120e17',
    theme_color: '#120e17',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
