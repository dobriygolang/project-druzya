import { Fragment } from 'react'
import { useI18n } from '@/lib/i18n'

export function LandingPhilosophy() {
  const { t } = useI18n()
  const lines = t('welcome.philosophyBody').split('\n')

  return (
    <section id="manifesto" className="scroll-mt-24 border-t border-winter-border bg-[#080808] py-32">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-8 font-mono text-sm uppercase tracking-widest text-winter-muted">
          {t('welcome.philosophyTitle')}
        </h2>

        <div className="mx-auto max-w-none text-lg leading-relaxed text-gray-300">
          <p className="m-0">
            {lines.map((line, index) => (
              <Fragment key={`${index}-${line.slice(0, 8)}`}>
                {line}
                {index < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </section>
  )
}
