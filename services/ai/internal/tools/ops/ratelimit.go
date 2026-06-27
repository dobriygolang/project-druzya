package ops

import (
	"sync"
	"time"
)

type ipLimiter struct {
	max    int
	window time.Duration
	mu     sync.Mutex
	hits   map[string][]time.Time
}

func newIPLimiter(maxPerMinute int) *ipLimiter {
	return &ipLimiter{
		max:    maxPerMinute,
		window: time.Minute,
		hits:   make(map[string][]time.Time),
	}
}

func (l *ipLimiter) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-l.window)

	l.mu.Lock()
	defer l.mu.Unlock()

	ts := l.hits[key]
	alive := ts[:0]
	for _, t := range ts {
		if t.After(cutoff) {
			alive = append(alive, t)
		}
	}
	if len(alive) >= l.max {
		l.hits[key] = alive
		return false
	}
	l.hits[key] = append(alive, now)
	return true
}
