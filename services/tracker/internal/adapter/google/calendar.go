package google

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

var (
	calTimePattern = regexp.MustCompile(`^(\d{1,2})[:.](\d{2})$`)
	calDatePattern = regexp.MustCompile(`^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$`)
)

// CreateEventFromTask inserts a calendar event from task title and metadata fields.
func (c *Client) CreateEventFromTask(ctx context.Context, refreshToken, title string, meta map[string]any) (string, error) {
	if !c.Configured() {
		return "", fmt.Errorf("google calendar not configured")
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return "", fmt.Errorf("calendar service: %w", err)
	}
	start, end, allDay := parseEventWindow(meta, time.Now().UTC())
	ev := &calendar.Event{
		Summary: title,
		Start:   &calendar.EventDateTime{},
		End:     &calendar.EventDateTime{},
	}
	if allDay {
		date := start.Format("2006-01-02")
		ev.Start.Date = date
		ev.End.Date = start.Add(24 * time.Hour).Format("2006-01-02")
	} else {
		ev.Start.DateTime = start.Format(time.RFC3339)
		ev.Start.TimeZone = "UTC"
		ev.End.DateTime = end.Format(time.RFC3339)
		ev.End.TimeZone = "UTC"
	}
	created, err := svc.Events.Insert("primary", ev).Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("create calendar event: %w", err)
	}
	return created.Id, nil
}

// UpdateEventFromTask updates an existing calendar event from task fields.
func (c *Client) UpdateEventFromTask(ctx context.Context, refreshToken, eventID, title string, meta map[string]any) error {
	if !c.Configured() {
		return fmt.Errorf("google calendar not configured")
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return fmt.Errorf("calendar service: %w", err)
	}
	start, end, allDay := parseEventWindow(meta, time.Now().UTC())
	ev := &calendar.Event{
		Summary: title,
		Start:   &calendar.EventDateTime{},
		End:     &calendar.EventDateTime{},
	}
	if allDay {
		date := start.Format("2006-01-02")
		ev.Start.Date = date
		ev.End.Date = start.Add(24 * time.Hour).Format("2006-01-02")
	} else {
		ev.Start.DateTime = start.Format(time.RFC3339)
		ev.Start.TimeZone = "UTC"
		ev.End.DateTime = end.Format(time.RFC3339)
		ev.End.TimeZone = "UTC"
	}
	if _, err := svc.Events.Update("primary", eventID, ev).Context(ctx).Do(); err != nil {
		return fmt.Errorf("update calendar event: %w", err)
	}
	return nil
}

// DeleteEvent removes a calendar event by id.
func (c *Client) DeleteEvent(ctx context.Context, refreshToken, eventID string) error {
	if !c.Configured() || eventID == "" {
		return nil
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return fmt.Errorf("calendar service: %w", err)
	}
	if err := svc.Events.Delete("primary", eventID).Context(ctx).Do(); err != nil {
		return fmt.Errorf("delete calendar event: %w", err)
	}
	return nil
}

// CreateEventFromSchedule inserts a timed calendar event from a work-task schedule.
func (c *Client) CreateEventFromSchedule(ctx context.Context, refreshToken, title string, start time.Time, durationMin int) (string, error) {
	if !c.Configured() {
		return "", fmt.Errorf("google calendar not configured")
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return "", fmt.Errorf("calendar service: %w", err)
	}
	end := start.Add(time.Duration(durationMin) * time.Minute)
	ev := &calendar.Event{
		Summary: title,
		Start: &calendar.EventDateTime{
			DateTime: start.UTC().Format(time.RFC3339),
			TimeZone: "UTC",
		},
		End: &calendar.EventDateTime{
			DateTime: end.UTC().Format(time.RFC3339),
			TimeZone: "UTC",
		},
	}
	created, err := svc.Events.Insert("primary", ev).Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("create calendar event: %w", err)
	}
	return created.Id, nil
}

// UpdateEventFromSchedule updates a timed calendar event from a work-task schedule.
func (c *Client) UpdateEventFromSchedule(ctx context.Context, refreshToken, eventID, title string, start time.Time, durationMin int) error {
	if !c.Configured() {
		return fmt.Errorf("google calendar not configured")
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return fmt.Errorf("calendar service: %w", err)
	}
	end := start.Add(time.Duration(durationMin) * time.Minute)
	ev := &calendar.Event{
		Summary: title,
		Start: &calendar.EventDateTime{
			DateTime: start.UTC().Format(time.RFC3339),
			TimeZone: "UTC",
		},
		End: &calendar.EventDateTime{
			DateTime: end.UTC().Format(time.RFC3339),
			TimeZone: "UTC",
		},
	}
	if _, err := svc.Events.Update("primary", eventID, ev).Context(ctx).Do(); err != nil {
		return fmt.Errorf("update calendar event: %w", err)
	}
	return nil
}

// CalendarEvent is a normalized Google Calendar event for the tracker API.
type CalendarEvent struct {
	ID     string
	Title  string
	Start  time.Time
	End    time.Time
	AllDay bool
}

// ListEvents returns primary-calendar events in [timeMin, timeMax).
func (c *Client) ListEvents(ctx context.Context, refreshToken string, timeMin, timeMax time.Time) ([]CalendarEvent, error) {
	if !c.Configured() {
		return nil, fmt.Errorf("google calendar not configured")
	}
	svc, err := calendar.NewService(ctx, option.WithTokenSource(c.TokenSource(ctx, refreshToken)))
	if err != nil {
		return nil, fmt.Errorf("calendar service: %w", err)
	}
	call := svc.Events.List("primary").Context(ctx).ShowDeleted(false).SingleEvents(true).OrderBy("startTime")
	if !timeMin.IsZero() {
		call = call.TimeMin(timeMin.UTC().Format(time.RFC3339))
	}
	if !timeMax.IsZero() {
		call = call.TimeMax(timeMax.UTC().Format(time.RFC3339))
	}
	resp, err := call.Do()
	if err != nil {
		return nil, fmt.Errorf("list calendar events: %w", err)
	}
	out := make([]CalendarEvent, 0, len(resp.Items))
	for _, item := range resp.Items {
		if item == nil {
			continue
		}
		ev, ok := calendarEventFromAPI(item)
		if !ok {
			continue
		}
		out = append(out, ev)
	}
	return out, nil
}

func calendarEventFromAPI(item *calendar.Event) (CalendarEvent, bool) {
	title := strings.TrimSpace(item.Summary)
	if title == "" {
		title = "(No title)"
	}
	if item.Start != nil && item.Start.Date != "" {
		start, err := time.Parse("2006-01-02", item.Start.Date)
		if err != nil {
			return CalendarEvent{}, false
		}
		end := start.Add(24 * time.Hour)
		if item.End != nil && item.End.Date != "" {
			if parsed, err := time.Parse("2006-01-02", item.End.Date); err == nil {
				end = parsed
			}
		}
		return CalendarEvent{
			ID:     item.Id,
			Title:  title,
			Start:  start,
			End:    end,
			AllDay: true,
		}, true
	}
	if item.Start == nil || item.Start.DateTime == "" {
		return CalendarEvent{}, false
	}
	start, err := time.Parse(time.RFC3339, item.Start.DateTime)
	if err != nil {
		return CalendarEvent{}, false
	}
	end := start.Add(time.Hour)
	if item.End != nil && item.End.DateTime != "" {
		if parsed, err := time.Parse(time.RFC3339, item.End.DateTime); err == nil {
			end = parsed
		}
	}
	return CalendarEvent{
		ID:     item.Id,
		Title:  title,
		Start:  start,
		End:    end,
		AllDay: false,
	}, true
}

func parseEventWindow(meta map[string]any, now time.Time) (start, end time.Time, allDay bool) {
	year, month, day := now.Date()
	if raw, ok := meta["event_date"].(string); ok && raw != "" {
		if y, m, d, ok := parseEventDate(raw, now); ok {
			year, month, day = y, m, d
		}
	}
	hour, min := 9, 0
	hasTime := false
	if raw, ok := meta["event_time"].(string); ok && raw != "" {
		if h, m, ok := parseEventTime(raw); ok {
			hour, min = h, m
			hasTime = true
		}
	}
	start = time.Date(year, month, day, hour, min, 0, 0, time.UTC)
	if hasTime {
		return start, start.Add(time.Hour), false
	}
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC), time.Time{}, true
}

func parseEventTime(raw string) (hour, min int, ok bool) {
	m := calTimePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if len(m) != 3 {
		return 0, 0, false
	}
	h, err := strconv.Atoi(m[1])
	if err != nil || h < 0 || h > 23 {
		return 0, 0, false
	}
	mi, err := strconv.Atoi(m[2])
	if err != nil || mi < 0 || mi > 59 {
		return 0, 0, false
	}
	return h, mi, true
}

func parseEventDate(raw string, now time.Time) (year int, month time.Month, day int, ok bool) {
	m := calDatePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if len(m) < 3 {
		return 0, 0, 0, false
	}
	d, err := strconv.Atoi(m[1])
	if err != nil || d < 1 || d > 31 {
		return 0, 0, 0, false
	}
	mo, err := strconv.Atoi(m[2])
	if err != nil || mo < 1 || mo > 12 {
		return 0, 0, 0, false
	}
	y := now.Year()
	if len(m) >= 4 && m[3] != "" {
		yr, err := strconv.Atoi(m[3])
		if err != nil {
			return 0, 0, 0, false
		}
		if yr < 100 {
			y = 2000 + yr
		} else {
			y = yr
		}
	}
	return y, time.Month(mo), d, true
}
