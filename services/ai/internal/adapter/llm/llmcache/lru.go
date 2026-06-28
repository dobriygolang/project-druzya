package llmcache

import (
	"container/list"
	"sync"
	"time"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

type cacheEntry struct {
	key       string
	resp      llmchain.Response
	expiresAt time.Time
}

type memoryStore struct {
	mu         sync.Mutex
	maxEntries int
	ttl        time.Duration
	items      map[string]*list.Element
	order      *list.List
}

func newMemoryStore(maxEntries int, ttl time.Duration) *memoryStore {
	if maxEntries <= 0 {
		maxEntries = 1000
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &memoryStore{
		maxEntries: maxEntries,
		ttl:        ttl,
		items:      make(map[string]*list.Element, maxEntries),
		order:      list.New(),
	}
}

func (s *memoryStore) get(key string) (llmchain.Response, bool) {
	if s == nil {
		return llmchain.Response{}, false
	}
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	el, ok := s.items[key]
	if !ok {
		return llmchain.Response{}, false
	}
	entry := el.Value.(*cacheEntry)
	if now.After(entry.expiresAt) {
		s.removeLocked(el)
		return llmchain.Response{}, false
	}
	s.order.MoveToFront(el)
	return entry.resp, true
}

func (s *memoryStore) set(key string, resp llmchain.Response) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if el, ok := s.items[key]; ok {
		entry := el.Value.(*cacheEntry)
		entry.resp = resp
		entry.expiresAt = time.Now().Add(s.ttl)
		s.order.MoveToFront(el)
		SetMemoryEntries(len(s.items))
		return
	}
	el := s.order.PushFront(&cacheEntry{
		key:       key,
		resp:      resp,
		expiresAt: time.Now().Add(s.ttl),
	})
	s.items[key] = el
	for len(s.items) > s.maxEntries {
		back := s.order.Back()
		if back == nil {
			break
		}
		s.removeLocked(back)
	}
	SetMemoryEntries(len(s.items))
}

func (s *memoryStore) removeLocked(el *list.Element) {
	entry := el.Value.(*cacheEntry)
	delete(s.items, entry.key)
	s.order.Remove(el)
}
