import { Link } from 'react-router-dom'
import { LegalLayout, LegalNavLink, LegalSection } from '@/components/legal/LegalLayout'

const UPDATED = '28 июня 2026'

export default function LegalPrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Privacy"
      title="Политика конфиденциальности"
      updated={UPDATED}
      nav={<LegalNavLink to="/legal/terms">Terms</LegalNavLink>}
      footer="Черновик под текущий MVP (microservices druz9.online). Детали хранения уточняются в production checklist."
    >
      <LegalSection title="1. Какие данные обрабатываем">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Аккаунт</strong> — username, avatar, telegram_id и/или yandex_id (identity
            service).
          </li>
          <li>
            <strong>Mock-интервью</strong> — сессии, ответы, код попыток, оценки (interview + ai
            services).
          </li>
          <li>
            <strong>Запуски кода</strong> — исходник, stdout/stderr, результаты тестов (sandbox
            service).
          </li>
          <li>
            <strong>Live-комнаты</strong> — содержимое редактора для синхронизации (rooms service).
          </li>
          <li>
            <strong>Рекомендации</strong> — профиль навыков и учебный план (recommendation service).
          </li>
          <li>
            <strong>Биллинг</strong> — план, счётчики использования (billing service).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Чего не собираем в MVP">
        <ul className="list-disc space-y-1 pl-5">
          <li>Email/пароль — только OAuth/Telegram через identity.</li>
          <li>Рекламные cookies и стороннюю web-аналитику.</li>
          <li>Доступ к файлам на вашем устройстве вне введённого вами кода/текста.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Зачем используем">
        <p>
          Для аутентификации, проведения mock-сессий, AI-оценки, квот тарифа, collab-редактора и
          персональных рекомендаций. Без продажи данных третьим лицам.
        </p>
      </LegalSection>

      <LegalSection title="4. AI-обработка">
        <p>
          Текст и код попыток отправляются в ai-service для scoring. Не передаём провайдеру ваш
          пароль или токены OAuth — только содержимое попытки, необходимое для оценки.
        </p>
      </LegalSection>

      <LegalSection title="5. Хранение и локализация">
        <p>
          Данные хранятся в PostgreSQL и Redis сервисов платформы. Production-развёртывание
          target'ит инфраструктуру в РФ — см. deploy checklist репозитория. JWT access-токен —
          в localStorage клиента; refresh — в Redis на backend.
        </p>
      </LegalSection>

      <LegalSection title="6. Ваши права">
        <p>
          Вы можете запросить информацию об обрабатываемых данных и удаление аккаунта, написав на{' '}
          <a href="mailto:privacy@druz9.ru" className="underline">
            privacy@druz9.ru
          </a>
          . Self-service export/delete в интерфейсе — в roadmap; пока через поддержку.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          Технические cookies/токены для сессии авторизации. Маркетинговых cookies нет. Подробнее
          — в{' '}
          <Link to="/legal/terms" className="underline">
            условиях использования
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Контакты">
        <p>
          DPO / privacy:{' '}
          <a href="mailto:privacy@druz9.ru" className="underline">
            privacy@druz9.ru
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
