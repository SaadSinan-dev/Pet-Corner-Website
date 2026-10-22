import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { resolveImageUrl } from './urls'

export function useSettings() { return useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => api.settings(signal), staleTime: 60000 }) }
export function useCategories() { return useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => api.categories(signal), staleTime: 60000 }) }
export function usePageMeta(title: string, description = 'كل ما يحتاجه رفيقك من طعام وألعاب ومستلزمات عناية. اكتشف متجر Pet Corner.', noindex = false, image?: string) {
  useEffect(() => {
    document.title = `${title} | Pet Corner`
    for (const [key, content, attribute] of [['description', description, 'name'], ['robots', noindex ? 'noindex,nofollow' : 'index,follow', 'name'], ['og:title', `${title} | Pet Corner`, 'property'], ['og:description', description, 'property'], ['og:type', 'website', 'property']] as const) {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attribute, key); document.head.append(meta) }
      meta.content = content
    }
    const imageMeta = document.head.querySelector('meta[property="og:image"]')
    imageMeta?.remove()
    const imageUrl = resolveImageUrl(image)
    if (imageUrl) { const meta = document.createElement('meta'); meta.setAttribute('property', 'og:image'); meta.content = new URL(imageUrl, location.origin).href; document.head.append(meta) }
    const siteUrl = import.meta.env.VITE_SITE_URL as string | undefined
    document.head.querySelector('link[rel="canonical"]')?.remove()
    if (siteUrl) { const link = document.createElement('link'); link.rel = 'canonical'; link.href = new URL(location.pathname, siteUrl).href; document.head.append(link) }
  }, [title, description, noindex, image])
}
