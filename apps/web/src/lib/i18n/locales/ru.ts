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
  seo: {
    defaultTitle: 'Спокойный workspace для тех, кто строит',
    defaultDescription:
      'Friends на druz9.online — заметки, план на день, pomodoro и live-комнаты в браузере для тех, кто создаёт продукты.',
    keywords:
      'Friends, druz9, workspace, заметки, задачи, pomodoro, live coding, коллаборация, фокус',
    ogImageAlt: 'Превью workspace Friends',
    madeWith: 'Сделано в Friends',
    goHome: 'Перейти на Friends',
    pages: {
      welcome: {
        title: 'Спокойный workspace для тех, кто строит',
        description:
          'Friends — заметки, план на день и pomodoro в desktop-приложении, плюс guest live-комнаты в браузере. druz9.online',
      },
      pricing: {
        title: 'Тарифы и лимиты',
        description: 'Free и Pro для Friends — заметки, live-комнаты, запуски кода и focus-статистика.',
      },
      legalTerms: {
        title: 'Условия использования',
        description: 'Условия использования Friends (druz9.online) — workspace, биллинг и live-коллаборация.',
      },
      legalPrivacy: {
        title: 'Политика конфиденциальности',
        description: 'Как Friends (druz9.online) обрабатывает персональные данные — аккаунт, биллинг и live-комнаты.',
      },
      liveNew: {
        title: 'Live-комнаты',
        description:
          'Создай guest live-комнату для кода или whiteboard на Friends — без регистрации. Работайте вместе в реальном времени.',
      },
      liveRoom: {
        title: 'Live-комната',
        description: 'Общий редактор в реальном времени на Friends — код или whiteboard с напарником.',
      },
      download: {
        title: 'Скачать desktop-приложение',
        description: 'Последняя версия desktop-приложения Friends для macOS и Windows.',
      },
      publishedNote: {
        title: '{{title}}',
        description: 'Опубликованная заметка на Friends (druz9.online).',
      },
      publishedBoard: {
        title: '{{title}}',
        description: 'Опубликованная доска на Friends (druz9.online).',
      },
    },
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
    memberSince: 'В Friends с {{date}}',
    quickLinks: {
      eyebrow: 'Workspace',
      title: 'Быстрые ссылки',
      downloadLabel: 'Скачать приложение',
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
    subtitle: 'Чем Free отличается от Pro в desktop-приложении Friends.',
    limitColumn: 'Лимит',
    desktopNote: 'Подписка оформляется в desktop-приложении — эта страница только для справки.',
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
    demoAriaLabel: 'Превью workspace Friends',
    demoHint: 'Попробуйте таймер',
    demoMenu: 'Меню',
    demoPlay: 'Запустить таймер',
    demoPause: 'Пауза',
    demoReset: 'Сбросить таймер',
    demoDockHome: 'Home',
    demoDockToday: 'Today',
    demoDockNotes: 'Notes',
    demoThemeWinter: 'Winter',
    demoThemeParticles: 'Particles',
    demoThemeDrift: 'Drift',
    demoThemeDebris: 'Debris',
    demoThemeLaunch: 'Launch',
    demoThemeVisor: 'Visor',
    demoNoteTitle: 'План на неделю',
    demoNoteBody:
      '## Фокус\n\n- Запустить демо на лендинге\n- Проверить UX task board\n- Pomodoro: 4 блока сегодня\n\n> Спокойные инструменты помогают закрывать важное.',
    demoTodayHeading: 'Сегодня',
    demoTask1: 'Написать release notes',
    demoTask2: 'Разобрать live room flow',
    demoTask3: 'Утренний focus block',
    preparingDownload: 'Готовим загрузку',
    downloadCta: 'Скачать приложение',
    downloadCtaVersion: 'Скачать приложение v{{version}}',
    downloadStarted: 'Загрузка началась',
    manifestoDownloadTitle: 'Возьми Friends с собой',
    manifestoDownloadHint: 'Desktop для macOS и Windows — всегда последний релиз',
    manifestoDownloadHintVersion: 'macOS и Windows · актуальная v{{version}}',
    allReleases: 'Все версии на GitHub',
    philosophyTitle: 'Наша философия',
    philosophyBody:
      'Friends — не ещё одна вкладка в браузере.\n' +
      'Это workspace для тех, кто строит: заметки, задачи и фокус в одном месте.\n' +
      '\n' +
      'Не нужно прыгать между Notion, таск-трекером, таймером и музыкой, чтобы просто начать работу.\n' +
      'Мы собрали планирование, writing и focus вместе — старт в одно нажатие.\n' +
      '\n' +
      'Большинство инструментов борются за ваше внимание. Friends защищает его.\n' +
      'Мы убрали лишнее и оставили поток, ясность и спокойствие.\n' +
      '\n' +
      'Когда вы открываете Friends, цель простая:\n' +
      'быть готовым, держать ориентир и закрывать важное сегодня.\n' +
      '\n' +
      'Нужно быстро поработать в паре? Откройте live-комнату — аккаунт не нужен.\n' +
      'Нужен личный vault заметок? В Friends он тоже есть.\n' +
      '\n' +
      'Если вам важно, что вы строите и как вы это делаете — это для вас.\n' +
      '\n' +
      'Добро пожаловать в ваш workspace.',
    footerCopyright: '© {{year}} Friends. Все права защищены.',
  },
  live: {
    brand: 'Friends live',
    loadingRoom: 'Загрузка комнаты…',
    roomNotFound: 'Комната не найдена',
    createNew: 'Создать новую',
    inviteBanner:
      'Отправь ссылку-приглашение гостю — он сможет войти без регистрации и редактировать код вместе с тобой.',
    hide: 'Скрыть',
    dismissError: 'Закрыть',
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
