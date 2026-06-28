#!/usr/bin/env python3
"""Generate Excalidraw onboarding diagrams for project-druzya."""

from __future__ import annotations

import json
import random
import string
import time
from pathlib import Path

OUT = Path(__file__).parent
_UPDATED = 1


def _id() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=16))


def _seed() -> int:
    return random.randint(1, 2**31 - 1)


def _finalize(elements: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, el in enumerate(elements):
        if el.get("type") == "frame":
            continue
        el = {k: v for k, v in el.items() if v is not None}
        el.pop("frameId", None)
        el["index"] = f"a{i}"
        el["updated"] = _UPDATED
        el.setdefault("roughness", 0)
        out.append(el)
    return out


def rect(
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    *,
    bg: str = "#ffffff",
    stroke: str = "#1e1e1e",
    font_size: int = 14,
    align: str = "left",
    roundness: int = 3,
    font_family: int = 2,
    sketch: bool = False,
) -> list[dict]:
    rid, tid = _id(), _id()
    r = {
        "id": rid,
        "type": "rectangle",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": bg,
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1 if sketch else 0,
        "opacity": 100,
        "groupIds": [],
        "roundness": {"type": roundness},
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [{"type": "text", "id": tid}],
        "link": None,
        "locked": False,
    }
    t = {
        "id": tid,
        "type": "text",
        "x": x + 8,
        "y": y + 8,
        "width": w - 16,
        "height": h - 16,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 1 if sketch else 0,
        "opacity": 100,
        "groupIds": [],
        "roundness": None,
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [],
        "link": None,
        "locked": False,
        "text": text,
        "originalText": text,
        "fontSize": font_size,
        "fontFamily": font_family,
        "textAlign": align,
        "verticalAlign": "top",
        "containerId": rid,
        "autoResize": True,
        "lineHeight": 1.25,
    }
    return [r, t]


def ellipse_db(x: float, y: float, w: float, h: float, text: str, *, sketch: bool = False) -> list[dict]:
    rid, tid = _id(), _id()
    r = {
        "id": rid,
        "type": "ellipse",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": "#1971c2",
        "backgroundColor": "#dbe4ff",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1 if sketch else 0,
        "opacity": 100,
        "groupIds": [],
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [{"type": "text", "id": tid}],
        "link": None,
        "locked": False,
    }
    t = {
        "id": tid,
        "type": "text",
        "x": x + 8,
        "y": y + h / 2 - 18,
        "width": w - 16,
        "height": 36,
        "angle": 0,
        "strokeColor": "#1971c2",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "roundness": None,
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [],
        "link": None,
        "locked": False,
        "text": text,
        "originalText": text,
        "fontSize": 12,
        "fontFamily": 2,
        "textAlign": "center",
        "verticalAlign": "middle",
        "containerId": rid,
        "autoResize": True,
        "lineHeight": 1.25,
    }
    return [r, t]


def label(x: float, y: float, text: str, *, size: int = 16, sketch: bool = False) -> dict:
    return {
        "id": _id(),
        "type": "text",
        "x": x,
        "y": y,
        "width": max(80, len(text) * size * 0.5),
        "height": size * 1.4,
        "angle": 0,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 1 if sketch else 0,
        "opacity": 100,
        "groupIds": [],
        "roundness": None,
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [],
        "link": None,
        "locked": False,
        "text": text,
        "originalText": text,
        "fontSize": size,
        "fontFamily": 2,
        "textAlign": "left",
        "verticalAlign": "top",
        "containerId": None,
        "autoResize": True,
        "lineHeight": 1.25,
    }


def arrow(
    x: float,
    y: float,
    dx: float,
    dy: float,
    *,
    stroke: str = "#1e1e1e",
    dashed: bool = False,
    sketch: bool = False,
) -> dict:
    return {
        "id": _id(),
        "type": "arrow",
        "x": x,
        "y": y,
        "width": dx,
        "height": dy,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "dashed" if dashed else "solid",
        "roughness": 1 if sketch else 0,
        "opacity": 100,
        "groupIds": [],
        "roundness": {"type": 2},
        "seed": _seed(),
        "version": 1,
        "versionNonce": _seed(),
        "isDeleted": False,
        "boundElements": [],
        "link": None,
        "locked": False,
        "points": [[0, 0], [dx, dy]],
        "lastCommittedPoint": None,
        "startBinding": None,
        "endBinding": None,
        "startArrowhead": None,
        "endArrowhead": "arrow",
        "elbowed": False,
    }


def schema(x: float, y: float, w: float, h: float, text: str) -> list[dict]:
    return rect(
        x, y, w, h, text,
        bg="#f8f9fa", stroke="#868e96", font_size=10, font_family=3, sketch=True,
    )


def svc_box(x: float, y: float, name: str, port: int, routes: list[str], *, bg: str = "#ffffff") -> list[dict]:
    body = f"{name}  :{port}\n" + "\n".join(routes)
    h = 36 + len(routes) * 15
    return rect(x, y, 185, h, body, bg=bg, font_size=11, sketch=True)


def external_box(x: float, y: float, name: str, note: str = "") -> list[dict]:
    txt = name if not note else f"{name}\n{note}"
    return rect(x, y, 120, 55 if note else 40, txt, bg="#dee2e6", font_size=11, align="center", sketch=True)


def redis_box(x: float, y: float, keys: list[str]) -> list[dict]:
    return rect(
        x, y, 150, 30 + len(keys) * 14,
        "Redis\n" + "\n".join(keys),
        bg="#ffc9c9", stroke="#c92a2a", font_size=10, sketch=True,
    )


def save(name: str, elements: list, scroll_x: float = 0, scroll_y: float = 0) -> None:
    doc = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": _finalize(elements),
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": "#ffffff",
            "scrollX": scroll_x,
            "scrollY": scroll_y,
        },
        "files": {},
    }
    path = OUT / name
    path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes, {len(doc['elements'])} elements)")


# ── palette ──────────────────────────────────────────────────────────────────
CLIENT = "#a5d8ff"
EDGE = "#ffd8a8"
CATALOG = "#b2f2bb"
RUNTIME = "#ffec99"
AI = "#ffc9c9"
BILLING = "#ffe066"
SVC = "#d0bfff"


def diagram_00_master() -> None:
    """Reference-style: user → edge → services + schemas + DB + Redis + externals."""
    els: list = []
    sk = True

    els.append(label(40, 10, "druzya — system design (onboarding)", size=22, sketch=sk))

    # ── top: user → caddy ──
    els += rect(40, 70, 70, 90, "User", bg=CLIENT, align="center", sketch=sk)
    els.append(arrow(110, 110, 50, 0, sketch=sk))
    els.append(label(120, 90, "HTTPS", size=11, sketch=sk))
    els += rect(170, 80, 220, 70, "Caddy / Vite\n(druz9.online)\n/v1/*  /ws/*", bg=EDGE, align="center", sketch=sk)
    els += rect(420, 95, 160, 40, "apps/web\nReact SPA", bg=CLIENT, align="center", font_size=11, sketch=sk)
    els.append(arrow(390, 115, 30, 0, stroke="#1971c2", sketch=sk))

    # fan from caddy
    caddy_x, caddy_y = 280, 150
    els.append(arrow(caddy_x, caddy_y, -180, 50, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, -60, 60, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 40, 65, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 200, 55, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 380, 45, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 560, 35, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 740, 25, stroke="#1971c2", sketch=sk))
    els.append(arrow(caddy_x, caddy_y, 920, 15, stroke="#1971c2", sketch=sk))

    # ── service row ──
    els += svc_box(40, 220, "identity", 8080, [
        "POST /v1/auth/telegram",
        "POST /v1/auth/yandex/exchange",
        "GET  /v1/me",
        "GET  /v1/jwt/public.pem",
    ], bg="#ffd8a8")
    els += svc_box(240, 230, "content", 8081, [
        "GET /v1/tasks/{id}",
        "GET /v1/tasks/{id}/bundle",
        "GET /v1/interview-templates/…/detail",
        "GET /v1/companies",
    ], bg=CATALOG)
    els += svc_box(440, 240, "interview", 8082, [
        "POST /v1/interview/sessions",
        "POST …/session-tasks/{id}/attempts",
        "GET  /v1/interview/sessions/{id}",
        "gRPC ClaimOutboxEvents (internal)",
    ], bg=RUNTIME)
    els += svc_box(640, 250, "ai", 8083, [
        "worker: poll outbox",
        "gRPC RunEvaluation",
        "gRPC CompleteEvaluation → interview",
    ], bg=AI)
    els += svc_box(840, 255, "recommendation", 8084, [
        "GET /v1/recommendations/dashboard",
        "worker: poll outbox (*)",
    ], bg=SVC)
    els += svc_box(1040, 260, "billing", 8085, [
        "GET  /v1/billing/me",
        "POST /v1/billing/webhooks/tribute",
        "gRPC CheckAndConsumeUsage",
    ], bg=BILLING)
    els += svc_box(1240, 265, "sandbox", 8086, [
        "POST /v1/sandbox/code-runs",
        "POST …/submit-attempt",
        "WS   /ws/lsp/go",
    ], bg="#99e9f2")
    els += svc_box(1440, 270, "rooms", 8087, [
        "POST /v1/rooms",
        "POST …/guest-join",
        "WS   /ws/editor/{roomId}",
    ], bg="#99e9f2")

    # ── externals + redis (left) ──
    els += external_box(40, 400, "Telegram", "identity-bot")
    els += external_box(40, 470, "Yandex OAuth")
    els += redis_box(180, 400, [
        "login_code:{code}",
        "refresh:{hash}",
        "oauth_state:{s}",
        "exchange_code:{c}",
    ])
    els.append(arrow(100, 400, 80, -60, dashed=True, sketch=sk))
    els.append(label(60, 370, "login code", size=10, sketch=sk))

    # ── gRPC / outbox arrows between services ──
    els.append(arrow(425, 310, 15, 0, stroke="#e67700", sketch=sk))
    els.append(label(430, 295, "gRPC GetTask", size=10, sketch=sk))
    els.append(arrow(625, 320, 15, 0, stroke="#7950f2", dashed=True, sketch=sk))
    els.append(label(630, 305, "outbox\nattempt_submitted", size=9, sketch=sk))
    els.append(arrow(825, 325, 15, 0, stroke="#7950f2", dashed=True, sketch=sk))
    els.append(label(830, 310, "outbox *", size=10, sketch=sk))
    els.append(arrow(1025, 330, 15, 0, stroke="#e67700", sketch=sk))
    els.append(label(1030, 315, "CheckQuota", size=10, sketch=sk))

    els += external_box(640, 400, "LLM Groq", "ai adapter")
    els += external_box(1040, 400, "Tribute", "webhook → billing")
    els += external_box(1240, 400, "Docker", "sandbox runner")
    els.append(arrow(730, 360, 0, 40, dashed=True, sketch=sk))
    els.append(arrow(1130, 370, 0, 30, dashed=True, sketch=sk))
    els.append(arrow(1330, 380, 0, 20, dashed=True, sketch=sk))

    # ── postgres section ──
    els.append(label(40, 560, "PostgreSQL — database per service (отдельная БД, без cross-DB joins)", size=14, sketch=sk))

    els += ellipse_db(60, 590, 100, 45, "PG\nidentity", sketch=sk)
    els += schema(40, 650, 200, 130, """users {
  id          uuid PK
  username    text unique
  telegram_id bigint unique
  yandex_id   text unique
  avatar_url  text
  created_at  timestamptz
}""")

    els += ellipse_db(280, 590, 100, 45, "PG\ncontent", sketch=sk)
    els += schema(260, 650, 220, 175, """tasks {
  id         uuid PK
  type       text
  metadata   jsonb  ← tests
  status     text
}
interview_templates { … }
rubrics { … }
task_solutions { … }""")

    els += ellipse_db(520, 590, 100, 45, "PG\ninterview", sketch=sk)
    els += schema(500, 650, 230, 210, """interview_sessions {
  id, user_id, mode, status
  template_id, total_score
}
attempts {
  id, user_id, session_task_id
  task_id, answer_payload
  status
}
domain_outbox {
  id, event_name
  payload jsonb
  status, created_at
}""")

    els += ellipse_db(780, 590, 100, 45, "PG\nai", sketch=sk)
    els += schema(760, 650, 200, 110, """evaluation_jobs {
  id, attempt_id unique
  status, score
}
model_calls {
  id, job_id, provider
  tokens, latency_ms
}""")

    els += ellipse_db(1000, 590, 130, 45, "PG\nrecommendation", sketch=sk)
    els += schema(980, 650, 220, 175, """skill_scores {
  user_id, skill_key
  score, confidence
}
recommendations {
  user_id, type, title
  status, metadata
}
learning_plan_items { … }
processed_events { … }""")

    els += ellipse_db(1240, 590, 100, 45, "PG\nbilling", sketch=sk)
    els += schema(1220, 650, 210, 130, """subscriptions {
  user_id, plan_id
  current_period_end
}
usage_counters {
  user_id, metric
  period, used
}
provider_events { … }""")

    els += ellipse_db(1460, 590, 100, 45, "PG\nsandbox", sketch=sk)
    els += schema(1440, 650, 200, 110, """code_runs {
  id, user_id, task_id
  language, code
  run_type, status
  stdout, test_results
}""")

    els += ellipse_db(1680, 590, 90, 45, "PG\nrooms", sketch=sk)
    els += schema(1660, 650, 200, 110, """code_rooms {
  id, owner_id
  task_id, language
  expires_at, is_frozen
}
code_room_participants {
  room_id, user_id, role
}""")

    # dashed lines service → DB
    for sx, sy, dx, dy in [
        (130, 400, 0, 190),
        (340, 400, 0, 190),
        (540, 450, 0, 140),
        (730, 450, 0, 140),
        (950, 450, 0, 140),
        (1090, 450, 0, 140),
        (1330, 450, 0, 140),
        (1530, 450, 0, 140),
        (1730, 450, 0, 140),
    ]:
        els.append(arrow(sx, sy, dx, dy, dashed=True, stroke="#868e96", sketch=sk))

    els += rect(
        40, 890, 1820, 70,
        "Легенда: синие стрелки = HTTP (JWT Bearer) · оранжевые = gRPC sync · фиолетовые пунктир = outbox async\n"
        "Правило: сервис читает чужие данные только через gRPC adapter. Своя БД — только свои таблицы.",
        bg="#e7f5ff", font_size=12, sketch=sk,
    )

    save("00-master-architecture.excalidraw", els, scroll_x=-20, scroll_y=-10)


def diagram_01_overview() -> None:
    els: list = []
    els.append(label(40, 10, "01 — Обзор платформы druzya", size=20))
    els += rect(520, 50, 260, 60, "User (браузер)", bg=CLIENT, align="center")
    els += rect(480, 140, 340, 55, "apps/web — React SPA", bg=CLIENT, align="center")
    els += rect(480, 220, 340, 55, "Caddy / Vite proxy\n/v1/*  /ws/*", bg=EDGE, align="center")
    services = [
        (40, 320, "identity :8080\nAuth, JWT", "#ffd8a8"),
        (210, 320, "content :8081\nКаталог", CATALOG),
        (380, 320, "interview :8082\nСессии", RUNTIME),
        (550, 320, "ai :8083\nLLM", AI),
        (720, 320, "recommendation :8084\nСкиллы", SVC),
        (890, 320, "billing :8085\nКвоты", BILLING),
        (1060, 320, "sandbox :8086\nКод", "#99e9f2"),
        (40, 440, "rooms :8087\nLive collab", "#99e9f2"),
    ]
    for x, y, text, bg in services:
        els += rect(x, y, 155, 75, text, bg=bg, font_size=12, align="center")
    els += ellipse_db(380, 560, 190, 70, "Postgres\n8× druzya_*")
    els += ellipse_db(600, 560, 110, 70, "Redis")
    save("01-overview.excalidraw", els)


def diagram_02_services_data() -> None:
    els: list = []
    els.append(label(20, 10, "02 — Сервисы: ответственность и данные", size=20))
    cards = [
        (20, 50, "identity", "Auth, JWT, профиль", "PG users + Redis sessions", "→ JWT, gRPC GetUser", "#ffd8a8"),
        (420, 50, "content", "Каталог задач", "templates, tasks, rubrics", "→ GetTask, GetTaskBundle", CATALOG),
        (820, 50, "interview", "Runtime интервью", "sessions, attempts, outbox", "→ events → ai, rec", RUNTIME),
        (20, 430, "ai", "LLM-оценка", "evaluation_jobs", "← outbox, → CompleteEval", AI),
        (420, 430, "recommendation", "Скиллы, план", "skill_scores, recs", "← outbox *", SVC),
        (820, 430, "billing", "Квоты", "subscriptions, usage", "gRPC CheckAndConsume", BILLING),
    ]
    for x, y, title, role, storage, comms, bg in cards:
        els += rect(x, y, 380, 45, title, bg=bg, font_size=18, align="center")
        els += rect(x, y + 50, 380, 85, role, font_size=12)
        els += rect(x, y + 140, 380, 120, storage, bg="#f8f9fa", font_size=11)
        els += rect(x, y + 265, 380, 120, comms, bg="#fff9db", font_size=11)
    save("02-services-and-data.excalidraw", els, scroll_y=-50)


def diagram_03_sync() -> None:
    els: list = []
    els.append(label(40, 10, "03 — HTTP + gRPC", size=20))
    table = """Caddy: /v1/auth* → identity | /v1/tasks* → content
/v1/interview* → interview | /v1/sandbox* → sandbox
gRPC: interview→content,billing | ai→interview,content | sandbox→content,interview"""
    els += rect(40, 50, 900, 180, table, font_size=13)
    save("03-sync-communication.excalidraw", els)


def diagram_04_async() -> None:
    els: list = []
    els.append(label(40, 10, "04 — Outbox", size=20))
    flow = """SubmitAttempt → domain_outbox(attempt_submitted) → ai worker
CompleteEvaluation → attempt_evaluated → recommendation worker"""
    els += rect(40, 50, 900, 120, flow, font_size=13)
    save("04-async-flows.excalidraw", els)


def diagram_05_journeys() -> None:
    els: list = []
    els.append(label(40, 10, "05 — User Journeys", size=20))
    els += rect(40, 50, 900, 200,
                "Login: bot→Redis→POST /auth/telegram→JWT\n"
                "Interview: content→interview→sandbox→submit→ai→rec\n"
                "Live: POST /rooms→WS Yjs | Billing: Tribute webhook",
                font_size=13)
    save("05-user-journeys.excalidraw", els)


def main() -> None:
    global _UPDATED
    _UPDATED = int(time.time() * 1000)
    random.seed(42)
    diagram_00_master()
    diagram_01_overview()
    diagram_02_services_data()
    diagram_03_sync()
    diagram_04_async()
    diagram_05_journeys()


if __name__ == "__main__":
    main()
