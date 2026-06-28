package billingapi

// ProTrialConfig controls the one-time free Pro trial promo.
type ProTrialConfig struct {
	Enabled bool
	Days    int
}
