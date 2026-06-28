-- +goose Up
-- +goose StatementBegin
CREATE TABLE llm_runtime_config (
    id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    version    BIGINT NOT NULL DEFAULT 0,
    config     JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO llm_runtime_config (id, version, config) VALUES (1, 0, '{}');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
