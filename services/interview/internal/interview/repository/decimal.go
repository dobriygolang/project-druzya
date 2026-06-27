package repository

import (
	"fmt"

	"github.com/shopspring/decimal"
)

type decimalScan struct {
	decimal.Decimal
}

func (d *decimalScan) Scan(src any) error {
	if src == nil {
		d.Decimal = decimal.Zero
		return nil
	}
	switch v := src.(type) {
	case string:
		dec, err := decimal.NewFromString(v)
		if err != nil {
			return fmt.Errorf("parse decimal: %w", err)
		}
		d.Decimal = dec
		return nil
	case []byte:
		dec, err := decimal.NewFromString(string(v))
		if err != nil {
			return fmt.Errorf("parse decimal: %w", err)
		}
		d.Decimal = dec
		return nil
	case float64:
		d.Decimal = decimal.NewFromFloat(v)
		return nil
	default:
		return fmt.Errorf("unsupported decimal source %T", src)
	}
}
