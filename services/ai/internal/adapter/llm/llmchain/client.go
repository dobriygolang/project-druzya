package llmchain

import "context"

// ChatClient — минимальный контракт, которому удовлетворяет *Chain и любой
// декоратор вокруг него (в частности llmcache.CachingChain). Вводится для
// того чтобы новые слои (semantic-cache, tracing, shadow-routing) могли
// оборачивать цепочку без конвертации структур в каждом вызывателе.
//
// Motivation: до декораторов сервисы держали *Chain напрямую в полях
// (copilot/infra.ChainedLLM и т.д.). Чтобы внедрить кеш без принуждения
// колонок к *Chain, callers теперь хранят ChatClient. Сам *Chain реализует
// его implicitly — никаких изменений в chain.go, только публичный
// интерфейс в отдельном файле.
//
// Stream-декораторы кешировать не обязаны (streaming несовместим со
// snapshot-кешем) — интерфейс всё равно включает ChatStream, чтобы
// декоратор мог проксировать его к underlying Chain без специальной
// обвязки у вызывающего кода.
type ChatClient interface {
	Chat(ctx context.Context, req Request) (Response, error)
	ChatStream(ctx context.Context, req Request) (<-chan StreamEvent, error)
}

// Compile-time guard.
var _ ChatClient = (*Chain)(nil)
