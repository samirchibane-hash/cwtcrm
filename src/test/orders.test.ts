import { describe, it, expect } from 'vitest';
import {
  getShipmentProgress,
  getStatusForShipments,
  normalizeOrderStatus,
  type OrderShipment,
} from '@/data/orders';

const shipment = (items: OrderShipment['items'], id = 's1'): OrderShipment => ({
  id,
  shippedOn: '2026-09-01',
  items,
  createdAt: '2026-09-01T00:00:00.000Z',
});

describe('normalizeOrderStatus', () => {
  it('keeps current statuses as-is', () => {
    expect(normalizeOrderStatus('Paid')).toBe('Paid');
    expect(normalizeOrderStatus('PO Received')).toBe('PO Received');
  });

  it('splits the retired PO/Invoice status by whether an invoice link exists', () => {
    expect(normalizeOrderStatus('PO/Invoice', 'https://connect.intuit.com/t/abc')).toBe('Invoiced');
    expect(normalizeOrderStatus('PO/Invoice', '')).toBe('PO Received');
    expect(normalizeOrderStatus('PO/Invoice', 'Loaner')).toBe('PO Received');
  });

  it('falls back to PO Received for unknown values', () => {
    expect(normalizeOrderStatus(undefined)).toBe('PO Received');
    expect(normalizeOrderStatus('Shipped')).toBe('PO Received');
  });
});

describe('getShipmentProgress', () => {
  const modelItems = [
    { modelName: '2 GPM', quantity: 30 },
    { modelName: '10 GPM', quantity: 2 },
    { modelName: '2 GPM', quantity: 20 }, // same model on a second line
  ];

  it('merges models across order lines and counts shipped units', () => {
    const progress = getShipmentProgress({
      modelItems,
      shipments: [shipment([{ modelName: '2 GPM', quantity: 12 }]), shipment([{ modelName: '2 GPM', quantity: 18 }, { modelName: '10 GPM', quantity: 2 }], 's2')],
    });
    expect(progress.lines).toEqual([
      { modelName: '2 GPM', ordered: 50, shipped: 30, remaining: 20 },
      { modelName: '10 GPM', ordered: 2, shipped: 2, remaining: 0 },
    ]);
    expect(progress).toMatchObject({ ordered: 52, shipped: 32, remaining: 20 });
  });

  it('never reports negative remaining when a model is over-shipped', () => {
    const progress = getShipmentProgress({
      modelItems: [{ modelName: '2 GPM', quantity: 5 }],
      shipments: [shipment([{ modelName: '2 GPM', quantity: 7 }])],
    });
    expect(progress.remaining).toBe(0);
  });

  it('handles orders with no shipment log', () => {
    expect(getShipmentProgress({ modelItems })).toMatchObject({ shipped: 0, remaining: 52 });
  });
});

describe('getStatusForShipments', () => {
  const progress = (ordered: number, shipped: number) => ({
    lines: [],
    ordered,
    shipped,
    remaining: Math.max(0, ordered - shipped),
  });

  it('moves open orders to Partially Shipped, then Delivered', () => {
    expect(getStatusForShipments('Paid', progress(50, 20))).toBe('Partially Shipped');
    expect(getStatusForShipments('Partially Shipped', progress(50, 50))).toBe('Delivered');
  });

  it('moves a Delivered order back when a shipment is removed', () => {
    expect(getStatusForShipments('Delivered', progress(50, 30))).toBe('Partially Shipped');
  });

  it('leaves loaners, empty logs and unchanged statuses alone', () => {
    expect(getStatusForShipments('Loaner', progress(2, 1))).toBeNull();
    expect(getStatusForShipments('Invoiced', progress(50, 0))).toBeNull();
    expect(getStatusForShipments('Partially Shipped', progress(50, 10))).toBeNull();
  });
});
