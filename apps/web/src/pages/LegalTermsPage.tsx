import { Link } from 'react-router-dom'
import { LegalLayout, LegalNavLink, LegalSection } from '@/components/legal/LegalLayout'

const UPDATED = '28 июня 2026'

export default function LegalTermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Условия использования"
      updated={UPDATED}
      nav={<LegalNavLink to="/legal/privacy">Privacy</LegalNavLink>}
      footer="Черновик для MVP druz9.online. Финальная юридическая редактура — до public launch."
    >
      <LegalSection title="1. Сервис">
        <p>
          druz9.online — платформа для подготовки к техническим собеседованиям: mock-интервью,
          запуск кода, AI-оценка ответов и рекомендации по навыкам. Используя сервис, вы
          соглашаетесь с этими условиями.
        </p>
      </LegalSection>

      <LegalSection title="2. Аккаунт">
        <p>
          Регистрация происходит через Telegram или Yandex ID. Вы отвечаете за сохранность доступа
          к своему аккаунту у провайдера авторизации. Один человек — один аккаунт, если иное не
          согласовано с поддержкой.
        </p>
      </LegalSection>

      <LegalSection title="3. Допустимое использование">
        <ul className="list-disc space-y-1 pl-5">
          <li>Не злоупотребляйте API, квотами и автоматизированными скриптами.</li>
          <li>Не загружайте вредоносный код в sandbox и live-комнаты.</li>
          <li>Не публикуйте чужие персональные данные без согласия.</li>
          <li>Не пытайтесь обойти лимиты тарифного плана.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Контент и AI-оценка">
        <p>
          Задачи и rubrics предоставляются catalog-сервисом. AI-оценка генерируется автоматически
          и носит рекомендательный характер — не является hiring decision. Мы не гарантируем
          прохождение реального собеседования.
        </p>
      </LegalSection>

      <LegalSection title="5. Тарифы">
        <p>
          Лимиты Free/Pro описаны на{' '}
          <Link to="/pricing" className="underline">
            странице тарифов
          </Link>{' '}
          и применяются billing-service. Оплата Pro — когда checkout будет доступен в интерфейсе.
        </p>
      </LegalSection>

      <LegalSection title="6. Ограничение ответственности">
        <p>
          Сервис предоставляется «как есть». Мы не несём ответственности за косвенные убытки,
          потерю данных из-за действий третьих лиц или форс-мажора. Максимальная ответственность
          ограничена суммой, уплаченной вами за Pro за последние 12 месяцев (если применимо).
        </p>
      </LegalSection>

      <LegalSection title="7. Прекращение">
        <p>
          Вы можете прекратить использование в любой момент. Мы можем ограничить или закрыть
          аккаунт при нарушении этих условий с уведомлением, когда это возможно.
        </p>
      </LegalSection>

      <LegalSection title="8. Контакты">
        <p>
          Вопросы по условиям:{' '}
          <a href="mailto:legal@druz9.ru" className="underline">
            legal@druz9.ru
          </a>
          . Жалобы на злоупотребления:{' '}
          <a href="mailto:abuse@druz9.ru" className="underline">
            abuse@druz9.ru
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
