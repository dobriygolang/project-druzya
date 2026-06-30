import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { formatPageTitle, siteOrigin } from '@/lib/site/brand'
import { useI18n } from '@/lib/i18n'

export type DocumentMetaInput = {
  title: string
  description: string
  path?: string
  imagePath?: string
  noIndex?: boolean
  keywords?: string
}

const DEFAULT_OG_IMAGE = '/landing/landing-hero-light.png'

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applyDocumentMeta(input: DocumentMetaInput): void {
  const origin = siteOrigin()
  const path = input.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const url = `${origin}${path.startsWith('/') ? path : `/${path}`}`
  const imageUrl = `${origin}${input.imagePath ?? DEFAULT_OG_IMAGE}`
  const title = formatPageTitle(input.title)
  const { description } = input

  document.title = title
  upsertMeta('name', 'description', description)
  if (input.keywords) upsertMeta('name', 'keywords', input.keywords)
  upsertMeta('name', 'application-name', 'Friends')
  upsertMeta('name', 'robots', input.noIndex ? 'noindex, nofollow' : 'index, follow')

  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:site_name', 'Friends')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', imageUrl)
  upsertMeta('property', 'og:locale', document.documentElement.lang === 'ru' ? 'ru_RU' : 'en_US')

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', imageUrl)

  upsertLink('canonical', url)
}

export function useDocumentMeta(input: DocumentMetaInput): void {
  useEffect(() => {
    applyDocumentMeta(input)
  }, [input.title, input.description, input.path, input.imagePath, input.noIndex, input.keywords])
}

type RouteMetaKey =
  | 'welcome'
  | 'pricing'
  | 'legalTerms'
  | 'legalPrivacy'
  | 'liveNew'
  | 'liveRoom'
  | 'download'

function routeMetaKey(pathname: string): RouteMetaKey | null {
  if (pathname === '/welcome' || pathname === '/') return 'welcome'
  if (pathname === '/pricing') return 'pricing'
  if (pathname === '/legal/terms') return 'legalTerms'
  if (pathname === '/legal/privacy') return 'legalPrivacy'
  if (pathname === '/live/new') return 'liveNew'
  if (pathname.startsWith('/live/')) return 'liveRoom'
  if (pathname === '/download') return 'download'
  return null
}

/** Sets title/description/OG tags for standard marketing routes. */
export function RouteDocumentMeta() {
  const { pathname } = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    if (pathname.startsWith('/notes/') || pathname.startsWith('/board/')) return

    const key = routeMetaKey(pathname)
    if (!key) {
      applyDocumentMeta({
        title: t('seo.defaultTitle'),
        description: t('seo.defaultDescription'),
        keywords: t('seo.keywords'),
        path: pathname,
      })
      return
    }

    applyDocumentMeta({
      title: t(`seo.pages.${key}.title`),
      description: t(`seo.pages.${key}.description`),
      keywords: t('seo.keywords'),
      path: pathname,
      noIndex: key === 'download' ? true : undefined,
    })
  }, [pathname, t])

  return null
}
