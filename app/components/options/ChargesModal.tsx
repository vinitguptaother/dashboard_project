'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { StrategyLeg } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  legs: StrategyLeg[];
  brokeragePerOrder?: number; // default ₹20
}

interface LegCharges {
  brokerage: number;
  stt: number;
  transactionCharges: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  total: number;
}

function calculateLegCharges(
  premium: number,
  qty: number,
  lotSize: number,
  side: 'BUY' | 'SELL',
  brokeragePerOrder: number
): LegCharges {
  const turnover = premium * qty * lotSize;
  const brokerage = brokeragePerOrder; // flat per order

  // STT: 0.0625% on sell side only (options)
  const stt = side === 'SELL' ? turnover * 0.000625 : 0;

  // NSE transaction charges: 0.0495% of turnover
  const transactionCharges = turnover * 0.000495;

  // SEBI charges: ₹10 per crore (0.0001%)
  const sebiCharges = turnover * 0.000001;

  // Stamp duty: 0.003% on buy side only
  const stampDuty = side === 'BUY' ? turnover * 0.00003 : 0;

  // GST: 18% on (brokerage + transaction charges + SEBI charges)
  const gst = (brokerage + transactionCharges + sebiCharges) * 0.18;

  const total = brokerage + stt + transactionCharges + sebiCharges + stampDuty + gst;

  return { brokerage, stt, transactionCharges, sebiCharges, stampDuty, gst, total };
}

export default function ChargesModal({ isOpen, onClose, legs, brokeragePerOrder = 20 }: Props) {
  if (!isOpen) return null;

  const legCharges = useMemo(() => {
    return legs.map(leg => ({
      leg,
      charges: calculateLegCharges(leg.premium, leg.qty, leg.lotSize, leg.side, brokeragePerOrder),
    }));
  }, [legs, brokeragePerOrder]);

  const totals = useMemo(() => {
    const t = { brokerage: 0, stt: 0, transactionCharges: 0, sebiCharges: 0, stampDuty: 0, gst: 0, total: 0 };
    for (const lc of legCharges) {
      t.brokerage += lc.charges.brokerage;
      t.stt += lc.charges.stt;
      t.transactionCharges += lc.charges.transactionCharges;
      t.sebiCharges += lc.charges.sebiCharges;
      t.stampDuty += lc.charges.stampDuty;
      t.gst += lc.charges.gst;
      t.total += lc.charges.total;
    }
    return t;
  }, [legCharges]);

  const fmt = (v: number) => '₹' + v.toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Charges Calculator</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {/* Per-leg breakdown */}
          {legCharges.map(({ leg, charges }, i) => (
            <div key={leg.id} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  leg.side === 'SELL'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {leg.side === 'SELL' ? 'S' : 'B'}
                </span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {leg.strike} {leg.type}
                </span>
                <span className="text-[10px] text-gray-400">
                  {leg.qty} lot(s) x {leg.lotSize} = {leg.qty * leg.lotSize} qty @ ₹{leg.premium.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs ml-6">
                <span className="text-gray-500">Brokerage</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.brokerage)}</span>
                <span className="text-gray-500">STT</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.stt)}</span>
                <span className="text-gray-500">Transaction</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.transactionCharges)}</span>
                <span className="text-gray-500">SEBI</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.sebiCharges)}</span>
                <span className="text-gray-500">Stamp Duty</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.stampDuty)}</span>
                <span className="text-gray-500">GST (18%)</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmt(charges.gst)}</span>
                <span className="text-gray-700 dark:text-gray-300 font-semibold border-t border-gray-200 dark:border-gray-700 pt-1">Leg Total</span>
                <span className="text-right font-mono-nums font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">{fmt(charges.total)}</span>
              </div>
            </div>
          ))}

          {/* Grand total */}
          {legCharges.length > 1 && (
            <div className="mt-4 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-gray-500">Total Brokerage</span>
                <span className="text-right font-mono-nums">{fmt(totals.brokerage)}</span>
                <span className="text-gray-500">Total STT</span>
                <span className="text-right font-mono-nums">{fmt(totals.stt)}</span>
                <span className="text-gray-500">Total Transaction</span>
                <span className="text-right font-mono-nums">{fmt(totals.transactionCharges)}</span>
                <span className="text-gray-500">Total SEBI</span>
                <span className="text-right font-mono-nums">{fmt(totals.sebiCharges)}</span>
                <span className="text-gray-500">Total Stamp Duty</span>
                <span className="text-right font-mono-nums">{fmt(totals.stampDuty)}</span>
                <span className="text-gray-500">Total GST</span>
                <span className="text-right font-mono-nums">{fmt(totals.gst)}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-gray-600 pt-2 mt-1">Grand Total</span>
                <span className="text-right text-sm font-bold font-mono-nums text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-gray-600 pt-2 mt-1">{fmt(totals.total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <span className="text-[10px] text-gray-400">
            Charges are approximate. Brokerage: ₹{brokeragePerOrder}/order (discount broker).
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
