package catalog

import (
	"encoding/json"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// PlanPresentation is marketing metadata stored in plans.metadata.
type PlanPresentation struct {
	Tagline   string `json:"tagline"`
	Highlight bool   `json:"highlight"`
}

// ParsePlanPresentation decodes plans.metadata JSON.
func ParsePlanPresentation(raw json.RawMessage) PlanPresentation {
	if len(raw) == 0 {
		return PlanPresentation{}
	}
	var out PlanPresentation
	_ = json.Unmarshal(raw, &out)
	return out
}

// PlanCatalogItem is a public plan card for pricing UI.
type PlanCatalogItem struct {
	Slug       string
	Name       string
	Tagline    string
	Highlight  bool
	Highlights []string
	Features   map[string]bool
	Limits     map[string]PlanLimitSpec
}

// PlanLimitSpec is a static entitlement definition (no usage).
type PlanLimitSpec struct {
	Type      string
	Limit     *int
	Unlimited bool
	Period    string
	Value     bool
}

// BuildPlanCatalog assembles one pricing card from DB plan + entitlements.
func BuildPlanCatalog(plan model.Plan, items []model.PlanEntitlement) (PlanCatalogItem, error) {
	pres := ParsePlanPresentation(plan.Metadata)
	parsed := make(map[string]entitlement.Value, len(items))
	specs := make(map[string]PlanLimitSpec, len(items))
	features := make(map[string]bool, len(items))

	for _, item := range items {
		val, err := entitlement.Parse(item.ValueJSON)
		if err != nil {
			return PlanCatalogItem{}, fmt.Errorf("parse entitlement %q: %w", item.Key, err)
		}
		parsed[item.Key] = val
		specs[item.Key] = toLimitSpec(val)
		if val.Type == entitlement.TypeBool {
			features[item.Key] = val.Value
		}
	}

	name := plan.Name
	if plan.Slug == model.PlanProMonthly && name == "Pro Monthly" {
		name = "Pro"
	}

	tagline := pres.Tagline
	if tagline == "" && plan.Description != nil {
		tagline = *plan.Description
	}

	return PlanCatalogItem{
		Slug:       plan.Slug,
		Name:       name,
		Tagline:    tagline,
		Highlight:  pres.Highlight,
		Highlights: formatHighlights(plan.Slug, parsed),
		Features:   features,
		Limits:     specs,
	}, nil
}

func toLimitSpec(val entitlement.Value) PlanLimitSpec {
	spec := PlanLimitSpec{
		Type:      val.Type,
		Limit:     val.Limit,
		Unlimited: val.Limit == nil && (val.Type == entitlement.TypeCounter || val.Type == entitlement.TypeGauge),
		Period:    val.Period,
		Value:     val.Value,
	}
	if val.Type == entitlement.TypeBool {
		spec.Unlimited = false
	}
	return spec
}

var highlightOrder = []string{
	model.EntitlementCloudNotesCount,
	model.EntitlementCodeRunsPerDay,
	model.EntitlementLiveRoomsPerMonth,
	model.EntitlementLiveRoomsConcurrent,
}

func formatHighlights(planSlug string, parsed map[string]entitlement.Value) []string {
	var out []string
	for _, key := range highlightOrder {
		val, ok := parsed[key]
		if !ok {
			continue
		}
		switch key {
		case model.EntitlementLiveRoomsPerMonth, model.EntitlementLiveRoomsConcurrent:
			continue
		default:
			if line, ok := formatHighlight(planSlug, key, val); ok {
				out = append(out, line)
			}
		}
	}
	out = appendLiveRoomHighlights(out, parsed)
	return out
}

func appendLiveRoomHighlights(out []string, parsed map[string]entitlement.Value) []string {
	monthly, hasMonthly := parsed[model.EntitlementLiveRoomsPerMonth]
	concurrent, hasConcurrent := parsed[model.EntitlementLiveRoomsConcurrent]

	if hasConcurrent && concurrent.Type == entitlement.TypeGauge && concurrent.Limit != nil {
		return append(out, fmt.Sprintf("%d одновременных live-комнат", *concurrent.Limit))
	}
	if hasMonthly && monthly.Type == entitlement.TypeCounter && monthly.Limit == nil {
		return append(out, "Live-комнаты без лимита (beta)")
	}
	if hasMonthly && monthly.Type == entitlement.TypeCounter && monthly.Limit != nil {
		return append(out, fmt.Sprintf("%d live-комнат в месяц", *monthly.Limit))
	}
	return out
}

func formatHighlight(planSlug, key string, val entitlement.Value) (string, bool) {
	switch val.Type {
	case entitlement.TypeCounter:
		switch key {
		case model.EntitlementCodeRunsPerDay:
			if val.Limit == nil {
				return "Запуски кода без дневного лимита (beta)", true
			}
			return fmt.Sprintf("%d запусков кода в день", *val.Limit), true
		default:
			if val.Limit == nil {
				return humanizeKey(key) + " без лимита (beta)", true
			}
			return fmt.Sprintf("%d %s", *val.Limit, humanizeKey(key)), true
		}
	case entitlement.TypeGauge:
		switch key {
		case model.EntitlementCloudNotesCount:
			if val.Limit == nil {
				return "Облачные заметки без лимита", true
			}
			return fmt.Sprintf("%d облачных заметок", *val.Limit), true
		default:
			if val.Limit == nil {
				return humanizeKey(key) + " без лимита (beta)", true
			}
			return fmt.Sprintf("%d %s", *val.Limit, humanizeKey(key)), true
		}
	case entitlement.TypeBool:
		if !val.Value {
			return "", false
		}
		return humanizeKey(key), true
	default:
		return "", false
	}
}

func humanizeKey(key string) string {
	return key
}
