import { useI18n } from '@/lib/i18n'

export function LandingPhilosophy() {
  const { t } = useI18n()
  const paragraphs = t('welcome.philosophyParagraphs').split('\n')

  return (
    <section id="philosophy" className="relative bg-bg px-6 pb-24 pt-8 sm:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24"
        aria-hidden
        style={{
          background: 'linear-gradient(180deg, #fafaf8 0%, #fafaf8 100%)',
        }}
      />

      <div className="mx-auto max-w-[680px]">
        <h2 className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted">
          {t('welcome.philosophyTitle')}
        </h2>

        <div className="mt-12 space-y-6 text-[17px] leading-[1.75] text-text-secondary">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="m-0">
              {paragraph}
            </p>
          ))}
        </div>

        <p className="mt-10 text-center text-[15px] italic text-text-muted">{t('welcome.philosophySignoff')}</p>
      </div>
    </section>
  )
}
