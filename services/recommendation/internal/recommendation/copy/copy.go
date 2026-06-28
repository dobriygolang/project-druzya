package copy

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
)

func ImproveSkillTitle(lang, skill string) string {
	switch locale.Normalize(lang) {
	case locale.EN:
		return fmt.Sprintf("Improve %s", skill)
	default:
		return fmt.Sprintf("Прокачать: %s", skill)
	}
}

func ImproveSkillDescription(lang, skill string, score int) string {
	switch locale.Normalize(lang) {
	case locale.EN:
		return fmt.Sprintf("Your score on %s is %d/100. Focus on this area to boost readiness.", skill, score)
	default:
		return fmt.Sprintf("Оценка по %s — %d/100. Сфокусируйся на этой зоне, чтобы поднять готовность.", skill, score)
	}
}

func TakeMockTitle(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Take a mock interview"
	}
	return "Пройти mock-интервью"
}

func TakeMockDescription(lang string, readiness int) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Your readiness score is %d/100 — schedule a full mock interview to validate progress.", readiness)
	}
	return fmt.Sprintf("Готовность %d/100 — запланируй полноценное mock-интервью, чтобы проверить прогресс.", readiness)
}

func PracticeSectionTitle(lang, section string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Practice %s section", section)
	}
	return fmt.Sprintf("Потренировать секцию: %s", section)
}

func PracticeSectionDescription(lang, section, skill string, score int) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("After completing your %s session, focus on %s (score %d/100).", section, skill, score)
	}
	return fmt.Sprintf("После %s-сессии сфокусируйся на %s (оценка %d/100).", section, skill, score)
}

func RewriteAnswerTitle(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Rewrite your answer using STAR"
	}
	return "Перепиши ответ по STAR"
}

func RewriteAnswerDescription(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Restructure your behavioral answer with clear Situation, Task, Action, and Result sections."
	}
	return "Перестрой behavioral-ответ: Situation, Task, Action, Result."
}

func PracticeSystemDesignTitle(lang, criterion string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Practice %s in system design", criterion)
	}
	return fmt.Sprintf("Потренировать %s в system design", criterion)
}

func PracticeSystemDesignDescription(lang, criterion string, score int) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Focus on %s when designing systems — your recent score was %d/100.", criterion, score)
	}
	return fmt.Sprintf("Обрати внимание на %s при проектировании — недавняя оценка %d/100.", criterion, score)
}

func BriefRetryAction(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Start"
	}
	return "Пройти"
}

func BriefWeakSkillTitle(lang, skill string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Weak area: %s", skill)
	}
	return fmt.Sprintf("Слабая зона: %s", skill)
}

func BriefWeakSkillDescription(lang, skill string, score int) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Score %d/100 — practice tasks in this area.", score)
	}
	return fmt.Sprintf("Оценка %d/100 — потренируй задачи в этой зоне.", score)
}

func BriefPracticeAction(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Practice"
	}
	return "Тренировать"
}

func BriefReadArticleTitle(lang, articleTitle string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Read: %s", articleTitle)
	}
	return fmt.Sprintf("Прочитать: %s", articleTitle)
}

func BriefReadArticleAction(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Read"
	}
	return "Читать"
}

func BriefPracticeAfterReadTitle(lang, skill string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Practice: %s", skill)
	}
	return fmt.Sprintf("Практика: %s", skill)
}

func BriefPracticeAfterReadDescription(lang, articleTitle string) string {
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("You read «%s» — apply it in a solo session.", articleTitle)
	}
	return fmt.Sprintf("Вы прочитали «%s» — закрепи в solo-сессии.", articleTitle)
}

func BriefRecommendationAction(lang string, recType model.RecommendationType) string {
	switch recType {
	case model.RecommendationTypeTakeMockInterview:
		return BriefTakeMockAction(lang)
	case model.RecommendationTypeRewriteAnswer:
		if locale.Normalize(lang) == locale.EN {
			return "Review"
		}
		return "Разобрать"
	default:
		return BriefPracticeAction(lang)
	}
}

func BriefTakeMockAction(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Start mock"
	}
	return "Запустить mock"
}

func BriefStartMockTitle(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Start your first mock"
	}
	return "Начни с первого mock"
}

func BriefStartMockDescription(lang string) string {
	if locale.Normalize(lang) == locale.EN {
		return "Complete a mock interview to unlock readiness, weak spots, and a learning plan."
	}
	return "Пройди mock-интервью — появятся readiness, слабые зоны и план обучения."
}

func RetryTaskTitle(lang, taskTitle string) string {
	if taskTitle == "" {
		if locale.Normalize(lang) == locale.EN {
			return "Retry failed task"
		}
		return "Повторить задачу"
	}
	if locale.Normalize(lang) == locale.EN {
		return fmt.Sprintf("Retry: %s", taskTitle)
	}
	return fmt.Sprintf("Повтор: %s", taskTitle)
}
