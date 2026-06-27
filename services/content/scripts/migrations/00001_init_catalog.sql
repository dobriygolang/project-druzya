-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interview_templates (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    description    TEXT,
    target_role    TEXT,
    target_level   TEXT,
    passing_score  INT NOT NULL DEFAULT 85,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX interview_templates_company_id_idx ON interview_templates (company_id);
CREATE INDEX interview_templates_is_active_idx ON interview_templates (is_active);

CREATE TABLE template_sections (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id    UUID NOT NULL REFERENCES interview_templates(id) ON DELETE CASCADE,
    section_type   TEXT NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT,
    position       INT NOT NULL,
    passing_score  INT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT template_sections_type_check CHECK (
        section_type IN (
            'algorithm', 'live_coding', 'system_design', 'behavioral',
            'sql', 'debugging', 'architecture'
        )
    ),
    CONSTRAINT template_sections_position_unique UNIQUE (template_id, position)
);

CREATE INDEX template_sections_template_id_idx ON template_sections (template_id);

CREATE TABLE tasks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              TEXT NOT NULL UNIQUE,
    type              TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    difficulty        TEXT NOT NULL,
    estimated_minutes INT,
    metadata          JSONB NOT NULL DEFAULT '{}',
    status            TEXT NOT NULL DEFAULT 'draft',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tasks_type_check CHECK (
        type IN (
            'algorithm', 'live_coding', 'system_design', 'behavioral',
            'sql', 'debugging', 'architecture'
        )
    ),
    CONSTRAINT tasks_difficulty_check CHECK (
        difficulty IN ('easy', 'medium', 'hard')
    ),
    CONSTRAINT tasks_status_check CHECK (
        status IN ('draft', 'published', 'archived')
    )
);

CREATE INDEX tasks_type_status_idx ON tasks (type, status);

CREATE TABLE template_section_tasks (
    section_id UUID NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    position   INT NOT NULL,
    PRIMARY KEY (section_id, task_id),
    CONSTRAINT template_section_tasks_position_unique UNIQUE (section_id, position)
);

CREATE INDEX template_section_tasks_task_id_idx ON template_section_tasks (task_id);

CREATE TABLE task_solutions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    language      TEXT,
    solution_text TEXT NOT NULL,
    explanation   TEXT,
    complexity    TEXT,
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_solutions_task_id_idx ON task_solutions (task_id);
CREATE UNIQUE INDEX task_solutions_one_primary_idx ON task_solutions (task_id) WHERE is_primary;

CREATE TABLE rubrics (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type  TEXT NOT NULL,
    title      TEXT NOT NULL,
    version    INT NOT NULL DEFAULT 1,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rubrics_task_type_check CHECK (
        task_type IN (
            'algorithm', 'live_coding', 'system_design', 'behavioral',
            'sql', 'debugging', 'architecture'
        )
    )
);

CREATE INDEX rubrics_task_type_active_idx ON rubrics (task_type, is_active);

CREATE TABLE rubric_criteria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id   UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    weight      INT NOT NULL,
    max_score   INT NOT NULL DEFAULT 100,
    position    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rubric_criteria_position_unique UNIQUE (rubric_id, position),
    CONSTRAINT rubric_criteria_key_unique UNIQUE (rubric_id, key)
);

CREATE INDEX rubric_criteria_rubric_id_idx ON rubric_criteria (rubric_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS rubric_criteria;
DROP TABLE IF EXISTS rubrics;
DROP TABLE IF EXISTS task_solutions;
DROP TABLE IF EXISTS template_section_tasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS template_sections;
DROP TABLE IF EXISTS interview_templates;
DROP TABLE IF EXISTS companies;
-- +goose StatementEnd
