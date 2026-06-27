package service

import (
	"context"
	"testing"
)

func TestNormalizeLimit(t *testing.T) {
	t.Parallel()
	cases := map[string]struct {
		in   int
		want int
	}{
		"zero defaults":     {0, defaultLimit},
		"negative defaults": {-5, defaultLimit},
		"within range":      {10, 10},
		"over max capped":   {1000, maxLimit},
	}
	for name, tc := range cases {
		tc := tc
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if got := normalizeLimit(tc.in); got != tc.want {
				t.Fatalf("normalizeLimit(%d) = %d, want %d", tc.in, got, tc.want)
			}
		})
	}
}

func TestNormalizeOffset(t *testing.T) {
	t.Parallel()
	if got := normalizeOffset(-1); got != 0 {
		t.Fatalf("normalizeOffset(-1) = %d, want 0", got)
	}
	if got := normalizeOffset(7); got != 7 {
		t.Fatalf("normalizeOffset(7) = %d, want 7", got)
	}
}

// fakeStore embeds Store so only the methods exercised by a test need bodies;
// any unimplemented call panics, surfacing accidental repository access.
type fakeStore struct{ Store }

func TestGetCompanyRequiresIDOrSlug(t *testing.T) {
	t.Parallel()
	svc := New(Deps{Repo: fakeStore{}})
	_, err := svc.GetCompany(context.Background(), "", "")
	if !IsInvalidArgument(err) {
		t.Fatalf("expected invalid argument, got %v", err)
	}
}

func TestGetTaskBundleRequiresID(t *testing.T) {
	t.Parallel()
	svc := New(Deps{Repo: fakeStore{}})
	_, err := svc.GetTaskBundle(context.Background(), "")
	if !IsInvalidArgument(err) {
		t.Fatalf("expected invalid argument, got %v", err)
	}
}
