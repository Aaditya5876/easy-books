import { Injectable } from '@nestjs/common';
import { VAT_RATE } from '../../domain/vo';

export interface VatBreakdown {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
}

@Injectable()
export class VatService {
  calculate(subtotal: number, laborCharges = 0): VatBreakdown {
    const taxableAmount = subtotal + laborCharges;
    const vatAmount = Number((taxableAmount * VAT_RATE).toFixed(2));
    const totalAmount = Number((taxableAmount + vatAmount).toFixed(2));
    return { subtotal: taxableAmount, vatAmount, totalAmount, vatRate: VAT_RATE };
  }

  computeOrderTotals(items: Array<{ quantity: number; unitPrice: number }>, laborCharges = 0, isVat = false) {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    if (!isVat) {
      return { subtotal, laborCharges, vatAmount: 0, totalAmount: subtotal + laborCharges };
    }
    return this.calculate(subtotal, laborCharges);
  }
}
