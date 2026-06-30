import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { I18nProvider } from '@/lib/i18n'
import { LandingDownloadProvider } from '@/lib/landing/useLandingDownload'
import { clearTokens } from '@/lib/apiClient'
import { SiteThemeProvider } from '@/lib/site/useSiteTheme'
import App from '@/App'
import '@/styles/main.css'

clearTokens()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <ToastProvider>
            <SiteThemeProvider>
              <LandingDownloadProvider>
                <App />
              </LandingDownloadProvider>
            </SiteThemeProvider>
          </ToastProvider>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
