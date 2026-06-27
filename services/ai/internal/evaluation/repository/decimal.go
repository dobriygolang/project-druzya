package repository

import "github.com/shopspring/decimal"

func decimalPtrToNumeric(d *decimal.Decimal) any {
	if d == nil {
		return nil
	}
	return d.String()
}
