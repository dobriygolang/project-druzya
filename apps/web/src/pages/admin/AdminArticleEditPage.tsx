import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  getAdminArticle,
  listAdminTasks,
  upsertAdminArticle,
  type AdminArticleStatus,
  type AdminArticleVideo,
  type AdminArticleVideoProvider,
} from '@/lib/api/admin'
import { detectVideoProvider } from '@/lib/learn/video'
import { CheckboxMultiSelect } from '@/components/admin/FormControls'
import { inputClassName, labelClassName, SKILL_KEY_OPTIONS } from '@/lib/admin/options'

const STATUS_OPTIONS: { value: AdminArticleStatus; label: string }[] = [
  { value: 'ARTICLE_STATUS_DRAFT', label: 'draft' },
  { value: 'ARTICLE_STATUS_PUBLISHED', label: 'published' },
  { value: 'ARTICLE_STATUS_ARCHIVED', label: 'archived' },
]

const PROVIDER_OPTIONS: { value: AdminArticleVideoProvider; label: string }[] = [
  { value: 'ARTICLE_VIDEO_PROVIDER_YOUTUBE', label: 'YouTube' },
  { value: 'ARTICLE_VIDEO_PROVIDER_VIMEO', label: 'Vimeo' },
  { value: 'ARTICLE_VIDEO_PROVIDER_OTHER', label: 'Other (link)' },
]

function emptyVideo(position: number): AdminArticleVideo {
  return {
    title: '',
    url: '',
    provider: 'ARTICLE_VIDEO_PROVIDER_YOUTUBE',
    position,
  }
}

export default function AdminArticleEditPage() {
  const { slug: routeSlug = 'new' } = useParams()
  const isNew = routeSlug === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [id, setId] = useState<string>()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [skillKeys, setSkillKeys] = useState<string[]>([])
  const [customSkillKey, setCustomSkillKey] = useState('')
  const [status, setStatus] = useState<AdminArticleStatus>('ARTICLE_STATUS_DRAFT')
  const [readingMinutes, setReadingMinutes] = useState('')
  const [videos, setVideos] = useState<AdminArticleVideo[]>([])
  const [taskSlugs, setTaskSlugs] = useState<string[]>([])

  const tasksQ = useQuery({
    queryKey: ['admin-tasks-for-article'],
    queryFn: () => listAdminTasks({ limit: 200, status: 'published' }),
  })

  const taskOptions = (tasksQ.data?.tasks ?? []).map((t) => ({
    value: t.slug,
    label: `${t.title} (${t.slug})`,
  }))

  const skillKeyOptions = [
    ...SKILL_KEY_OPTIONS.map((key) => ({ value: key, label: key })),
    ...skillKeys
      .filter((k) => !SKILL_KEY_OPTIONS.includes(k as (typeof SKILL_KEY_OPTIONS)[number]))
      .map((key) => ({ value: key, label: `${key} (custom)` })),
  ]

  const articleQ = useQuery({
    queryKey: ['admin-article', routeSlug],
    queryFn: () => getAdminArticle(routeSlug),
    enabled: !isNew,
  })

  useEffect(() => {
    const article = articleQ.data?.article
    if (!article) return
    setId(article.id)
    setSlug(article.slug)
    setTitle(article.title)
    setSummary(article.summary)
    setBody(article.body)
    setSkillKeys(article.skill_keys ?? [])
    setStatus(article.status)
    setReadingMinutes(article.reading_minutes != null ? String(article.reading_minutes) : '')
    setVideos(
      article.videos?.length
        ? [...article.videos].sort((a, b) => a.position - b.position)
        : [],
    )
    setTaskSlugs(article.linked_tasks?.map((t) => t.slug) ?? [])
  }, [articleQ.data])

  const saveM = useMutation({
    mutationFn: () =>
      upsertAdminArticle({
        id,
        slug,
        title,
        summary,
        body,
        status,
        reading_minutes: readingMinutes ? Number(readingMinutes) : undefined,
        skill_keys: skillKeys,
        videos: videos
          .filter((v) => v.title.trim() && v.url.trim())
          .map((v, index) => ({
            ...v,
            position: index + 1,
            provider: v.url.trim() ? detectVideoProvider(v.url) : v.provider,
          })),
        task_slugs: taskSlugs,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['admin-articles'] })
      void qc.invalidateQueries({ queryKey: ['admin-article', res.article.slug] })
      if (isNew) {
        navigate(`/admin/articles/${encodeURIComponent(res.article.slug)}/edit`, { replace: true })
      }
    },
  })

  function updateVideo(index: number, patch: Partial<AdminArticleVideo>) {
    setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  if (!isNew && articleQ.isLoading) {
    return <p className="text-sm text-text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{isNew ? 'New article' : `Edit: ${slug}`}</h2>
        <Link to="/admin/articles" className="text-sm text-text-muted no-underline hover:text-text-primary">
          ← Back to list
        </Link>
      </div>

      <Card elevation="e1" className="space-y-3 p-4">
        <label className="block text-sm">
          Slug
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!isNew && !!id}
          />
        </label>
        <label className="block text-sm">
          Title
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Summary
          <textarea
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Body (markdown: ## headings, lists, `code`, **bold**, ``` blocks)
          <textarea
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 font-mono text-sm"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <CheckboxMultiSelect
          label="Skill keys"
          options={skillKeyOptions}
          selected={skillKeys}
          onChange={setSkillKeys}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            placeholder="Custom skill key, e.g. algorithm.graphs"
            value={customSkillKey}
            onChange={(e) => setCustomSkillKey(e.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!customSkillKey.trim()}
            onClick={() => {
              const key = customSkillKey.trim()
              if (key && !skillKeys.includes(key)) {
                setSkillKeys((prev) => [...prev, key])
              }
              setCustomSkillKey('')
            }}
          >
            Add custom
          </Button>
        </div>
        <label className={labelClassName}>
          Reading minutes
          <input
            type="number"
            min={1}
            className={inputClassName}
            value={readingMinutes}
            onChange={(e) => setReadingMinutes(e.target.value)}
          />
        </label>
        <CheckboxMultiSelect
          label="Linked practice tasks"
          options={taskOptions}
          selected={taskSlugs}
          emptyHint="No published tasks available."
          onChange={setTaskSlugs}
        />
        <label className="block text-sm">
          Status
          <select
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminArticleStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Videos</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVideos((prev) => [...prev, emptyVideo(prev.length + 1)])}
            >
              Add video
            </Button>
          </div>
          {videos.length === 0 ? (
            <p className="text-sm text-text-muted">No videos — add YouTube/Vimeo links for learners.</p>
          ) : null}
          {videos.map((video, index) => (
            <div key={index} className="space-y-2 rounded border border-border p-3">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-text-muted">Video {index + 1}</span>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-primary"
                  onClick={() => setVideos((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <input
                className="w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
                placeholder="Title"
                value={video.title}
                onChange={(e) => updateVideo(index, { title: e.target.value })}
              />
              <input
                className="w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
                placeholder="https://youtube.com/watch?v=..."
                value={video.url}
                onChange={(e) =>
                  updateVideo(index, {
                    url: e.target.value,
                    provider: e.target.value.trim()
                      ? detectVideoProvider(e.target.value)
                      : video.provider,
                  })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded border border-border bg-surface-1 px-3 py-2 text-sm"
                  value={video.provider}
                  onChange={(e) =>
                    updateVideo(index, { provider: e.target.value as AdminArticleVideoProvider })
                  }
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  className="rounded border border-border bg-surface-1 px-3 py-2 text-sm"
                  placeholder="Duration (sec)"
                  value={video.duration_seconds ?? ''}
                  onChange={(e) =>
                    updateVideo(index, {
                      duration_seconds: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            loading={saveM.isPending}
            disabled={!slug || !title || !summary || !body}
            onClick={() => saveM.mutate()}
          >
            Save
          </Button>
          {slug ? (
            <Link
              to={`/learn/${encodeURIComponent(slug)}?preview=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm no-underline hover:bg-surface-2"
            >
              Preview
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
