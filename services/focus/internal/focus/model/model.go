package model

import "time"

type Session struct {
	ID                 string
	UserID             string
	Mode               string
	PinnedTitle        string
	TaskID             *string
	StartedAt          time.Time
	EndedAt            *time.Time
	SecondsFocused     int
	PomodorosCompleted int
}

type FocusDay struct {
	Date     string
	Seconds  int
	Sessions int
}

type Stats struct {
	CurrentStreakDays  int
	LongestStreakDays  int
	TotalFocusedSeconds int
	Heatmap            []FocusDay
	LastSevenDays      []FocusDay
}
