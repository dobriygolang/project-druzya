import { legalRu } from './legal.ru'

export const ru = {
  locale: {
    label: 'Язык',
    ru: 'Русский',
    en: 'English',
  },
  common: {
    loading: 'Загрузка…',
    error: 'Ошибка',
    retry: 'Повторить',
    guest: 'Guest',
    pricing: 'Тарифы',
    or: 'или',
    unlimited: 'без лимита',
    current: '(текущий)',
  },
  public: {
    features: 'Возможности',
    pricing: 'Тарифы',
    liveCoding: 'Live-комнаты',
    home: 'Главная',
    openApp: 'Аккаунт',
    account: 'Аккаунт',
    startFree: 'Войти',
    back: 'Назад',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
  },
  shell: {
    profile: 'Профиль',
    pricing: 'Тарифы',
    about: 'О продукте',
    logout: 'Выйти',
    accountMenu: 'Меню аккаунта',
    accountFallback: 'Аккаунт',
  },
  billing: {
    eyebrow: 'Billing',
    title: 'Подписка и лимиты',
    plan: 'План',
    yourPlan: 'Твой план',
    loading: 'Загрузка подписки…',
    noLimits: 'Лимиты не настроены для плана.',
    periodDay: ' сегодня',
    periodMonth: ' в месяц',
    usedOf: '{{used}} из {{limit}}{{period}}',
    usedOnly: '{{used}}{{period}}',
    upgradeHint: 'Перейди на Pro — больше заметок, live-комнат и запусков кода.',
    upgradeTitle: 'Оформить Pro',
    upgradeCta: 'Смотреть Pro',
    counters: {
      cloud_notes_count: 'Облачные заметки',
      code_runs_per_day: 'Запуски кода',
      live_rooms_per_month: 'Live-комнаты',
      live_rooms_concurrent: 'Одновременные live-комнаты',
      focus_stats_history_days: 'История focus-статистики',
    },
  },
  profile: {
    eyebrow: 'Профиль',
    memberSince: 'В Hone с {{date}}',
    quickLinks: {
      eyebrow: 'Workspace',
      title: 'Быстрые ссылки',
      downloadLabel: 'Скачать Hone',
      downloadHint: 'Desktop для macOS и Windows',
      liveLabel: 'Live-комнаты',
      liveHint: 'Guest-сессии кода и whiteboard',
    },
  },
  session: {
    editorFormatGoOnly: 'Форматирование доступно только для Go',
    editorFormatAuthExpired: 'Сессия авторизации истекла. Обновите страницу или войдите снова.',
    editorRunQuota: 'Дневной лимит запусков кода исчерпан. Обновите план на /pricing.',
    editorRunProFeature: 'Эта функция недоступна на текущем плане.',
  },
  login: {
    title: 'Добро пожаловать',
    subtitle: 'Войди через Telegram или Yandex — аккаунт создаётся автоматически при первом входе.',
    loginError: 'Ошибка входа',
    yandexError: 'Ошибка Yandex OAuth',
    telegram: 'Telegram',
    telegramHintOpen: 'Открой',
    telegramHintAfter: ', отправь /start login и введи код из бота.',
    submitTelegram: 'Войти через Telegram',
    openTelegramBot: 'Открыть бота в Telegram',
    submitYandex: 'Войти через Yandex',
    autoRegister: 'Нет аккаунта? Регистрация происходит автоматически при первом входе.',
  },
  pricing: {
    eyebrow: 'Тарифы',
    title: 'Планы и лимиты',
    subtitle: 'Чем Free отличается от Pro в десктопном Hone.',
    limitColumn: 'Лимит',
    desktopNote: 'Подписка оформляется в десктопном Hone — эта страница только для справки.',
  },
  checkout: {
    eyebrow: 'Оплата',
    title: 'Подписка Pro',
    subtitle: 'Оплата через Tribute. Перед оплатой привяжи Telegram.',
    planNotFound: 'План не найден — все тарифы на странице pricing.',
    backToPricing: '← Все тарифы',
    returnHint: 'После оплаты открой {{url}}, чтобы подтвердить подписку.',
    welcomeEyebrow: 'Добро пожаловать',
    welcomePro: 'Pro активен — спасибо за подписку!',
    welcomePending: 'Спасибо! Подтверждаем оплату…',
    goWelcome: 'На главную',
  },
  welcome: {
    version: '0.0.1',
    pill: 'РАННИЙ ДОСТУП',
    navPhilosophy: 'Философия',
    heroLine1: 'Глубокий фокус.',
    heroLine2: 'Красивый дизайн.',
    heroLine3: 'Для тех, кто строит.',
    heroBody:
      'Заметки, план на день и pomodoro в одном спокойном desktop-приложении — плюс live-комнаты в браузере.',
    heroLiveCta: 'Создать live-комнату',
    heroPreviewLine1: 'Сегодня · 3 задачи в плане',
    heroPreviewLine2: 'Заметки · недельный план синхронизирован',
    heroPreviewLine3: 'Фокус · 25:00 · streak 4',
    demoAriaLabel: 'Интерактивный превью workspace Hone',
    demoHint: 'Попробуйте таймер',
    demoMenu: 'Меню',
    demoPlay: 'Запустить таймер',
    demoPause: 'Пауза',
    demoReset: 'Сбросить таймер',
    preparingDownload: 'Готовим загрузку',
    downloadCta: 'Скачать Hone',
    downloadStarted: 'Загрузка началась',
    philosophyTitle: 'Наша философия',
    philosophyBody:
      'Hone — не ещё одна вкладка в браузере.\n' +
      'Это workspace для тех, кто строит: заметки, задачи и фокус в одном месте.\n' +
      '\n' +
      'Не нужно прыгать между Notion, таск-трекером, таймером и музыкой, чтобы просто начать работу.\n' +
      'Мы собрали планирование, writing и focus вместе — старт в одно нажатие.\n' +
      '\n' +
      'Большинство инструментов борются за ваше внимание. Hone защищает его.\n' +
      'Мы убрали лишнее и оставили поток, ясность и спокойствие.\n' +
      '\n' +
      'Когда вы открываете Hone, цель простая:\n' +
      'быть готовым, держать ориентир и закрывать важное сегодня.\n' +
      '\n' +
      'Нужно быстро поработать в паре? Откройте live-комнату — аккаунт не нужен.\n' +
      'Нужен личный vault заметок? В Hone он тоже есть.\n' +
      '\n' +
      'Если вам важно, что вы строите и как вы это делаете — это для вас.\n' +
      '\n' +
      'Добро пожаловать в ваш workspace.',
    footerCopyright: '© {{year}} Hone. Все права защищены.',
  },
  live: {
    brand: 'Hone live',
    loadingRoom: 'Загрузка комнаты…',
    roomNotFound: 'Комната не найдена',
    createNew: 'Создать новую',
    inviteBanner:
      'Отправь ссылку-приглашение гостю — он сможет войти без регистрации и редактировать код вместе с тобой.',
    hide: 'Скрыть',
    guestTitle: 'Вход как гость',
    guestDescription: 'Имя для отображения в редакторе. Доступ только на время сессии.',
    accessTitle: 'Нужен доступ',
    accessDescription:
      'Открой ссылку с ?invite=… от организатора или войди в аккаунт, если ты участник комнаты.',
    name: 'Имя',
    namePlaceholder: 'Кандидат',
    joinError: 'Ошибка входа',
    joinRoom: 'Войти в комнату',
    loginAccount: 'Войти в аккаунт',
    createOwnRoom: 'Создать свою комнату',
    hasAccount: 'Уже есть аккаунт?',
    login: 'Войти',
    newEyebrow: 'Live-комнаты',
    newTitle: 'Общий редактор в реальном времени',
    newBody:
      'Создай комнату без регистрации — получишь ссылку-приглашение для напарника. Синхронизация через Yjs, запуск кода через sandbox.',
    newBulletGuest: 'Без аккаунта — создайте или войдите как гость',
    newBulletPair: 'Pair programming с курсорами участников',
    newBulletRun: '⌘↵ Run — проверка кода в sandbox',
    newCardTitle: 'Новая комната',
    newCardAuthed: 'Комната привязана к аккаунту — можно приглашать по ссылке.',
    newCardGuest: 'Имя видно напарнику в редакторе. Аккаунт не нужен.',
    yourName: 'Ваше имя',
    language: 'Язык',
    roomMode: 'Тип комнаты',
    roomModeCode: 'Live coding',
    roomModeDiagram: 'Whiteboard',
    diagramRoom: 'Excalidraw',
    createRoom: 'Создать комнату',
    hasAccountShort: 'Есть аккаунт?',
    ttlNote: 'Комната живёт несколько часов. Данные не сохраняются после истечения TTL.',
    closeRoom: 'Закрыть комнату',
    reconnect: 'Переподключить',
    invite: 'Пригласить',
    inviteCopied: 'Ссылка скопирована',
    inviteTitle: 'Скопировать ссылку для гостя',
    settings: 'Настройки',
    copyInvite: 'Скопировать invite',
    inviteCopiedMenu: 'Invite скопирован',
    freeze: 'Заморозить редактор',
    unfreeze: 'Разморозить редактор',
    noSettings: 'Нет настроек комнаты',
    run: 'Run',
    running: 'Running…',
    output: 'Вывод',
    roomLanguage: 'Язык комнаты',
    fontDecrease: 'Уменьшить шрифт',
    fontIncrease: 'Увеличить шрифт',
    timerRemaining: 'Осталось',
    timerSession: 'Сессия',
    timerCountdownTitle: 'Комната будет закрыта по истечении времени',
    timerElapsedTitle: 'Длительность текущей сессии',
    wsFrozen: 'FROZEN',
    wsLive: 'LIVE',
    wsOffline: 'OFFLINE',
    wsReconnecting: 'RECONNECT…',
    wsConnecting: 'CONNECT…',
  },
  legal: legalRu,
} as const

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>
}

export type Messages = DeepStringRecord<typeof ru>
