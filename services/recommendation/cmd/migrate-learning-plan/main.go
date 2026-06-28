package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	trackergrpc "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker/grpc"
)

type planItem struct {
	ID       string
	UserID   string
	Type     string
	Title    string
	Metadata map[string]any
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	dsn := env("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5436/druzya_recommendation?sslmode=disable")
	trackerAddr := env("TRACKER_GRPC_ADDR", "127.0.0.1:9099")
	internalToken := os.Getenv("INTERNAL_API_TOKEN")
	if internalToken == "" {
		log.Fatal("INTERNAL_API_TOKEN is required")
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()

	exists, err := tableExists(ctx, pool, "learning_plan_items")
	if err != nil {
		log.Fatalf("check table: %v", err)
	}
	if !exists {
		log.Println("learning_plan_items not found — already migrated")
		return
	}

	items, err := listPendingPlanItems(ctx, pool)
	if err != nil {
		log.Fatalf("list plan items: %v", err)
	}
	if len(items) == 0 {
		log.Println("no pending learning plan items")
		return
	}

	tracker, err := trackergrpc.NewClient(ctx, trackerAddr, internalToken)
	if err != nil {
		log.Fatalf("tracker client: %v", err)
	}
	defer tracker.Close()

	var migrated, skipped int
	for _, item := range items {
		meta := item.Metadata
		if meta == nil {
			meta = map[string]any{}
		}
		meta["migrated_from"] = "learning_plan"
		meta["plan_item_id"] = item.ID
		meta["plan_item_type"] = item.Type
		meta["task_kind"] = "system"
		dedup := fmt.Sprintf("migrated:plan:%s", item.ID)
		created, err := tracker.CreateTaskInternal(ctx, trackeradapter.CreateTaskParams{
			UserID:   item.UserID,
			Title:    item.Title,
			Source:   "recommendation",
			Metadata: meta,
			DedupKey: &dedup,
		})
		if err != nil {
			log.Printf("skip item %s: %v", item.ID, err)
			skipped++
			continue
		}
		if created {
			migrated++
		} else {
			skipped++
		}
	}
	log.Printf("done: migrated=%d skipped=%d total=%d", migrated, skipped, len(items))
}

func tableExists(ctx context.Context, pool *pgxpool.Pool, name string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	`, name).Scan(&ok)
	return ok, err
}

func listPendingPlanItems(ctx context.Context, pool *pgxpool.Pool) ([]planItem, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, user_id, type, title, metadata
		FROM learning_plan_items
		WHERE status IN ('pending', 'in_progress')
		ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []planItem
	for rows.Next() {
		var item planItem
		var meta []byte
		if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.Title, &meta); err != nil {
			return nil, err
		}
		if len(meta) > 0 {
			_ = json.Unmarshal(meta, &item.Metadata)
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
