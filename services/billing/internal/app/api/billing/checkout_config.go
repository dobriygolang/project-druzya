package billingapi

// PlanCheckoutURLs holds external payment links for a plan (Tribute).
type PlanCheckoutURLs struct {
	WebURL      string
	TelegramURL string
}

// CheckoutConfig maps plan_slug → Tribute checkout links for the pricing UI.
type CheckoutConfig struct {
	ByPlan map[string]PlanCheckoutURLs
}

// URLsFor returns checkout links for a plan slug.
func (c CheckoutConfig) URLsFor(planSlug string) PlanCheckoutURLs {
	if c.ByPlan == nil {
		return PlanCheckoutURLs{}
	}
	return c.ByPlan[planSlug]
}
