'use client';

/**
 * TaxLotOptimizerModal — Phase 6 deliverable #5.
 *
 * Given a symbol + default quantity (e.g. a holding row), calls
 * /api/tax-optimizer/suggest and shows the recommended lot-by-lot
 * exit plan plus estimated tax savings vs FIFO.
 *
 * ADVISORY ONLY. No order is placed.
 */

import { useEffect, useState } from 'react';
import { X, Loader2, Calculator, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

interface LotPlan {
  buyDate: string;
  buyPrice: number;
  quantity: number;
  taxCategory: 'STCG' | 'LTCG';
  taxRate: number;
  gainPerShare: number;
  gain: number;
  estimatedTax: number;
  source: string;
}

interface Suggestion {
  symbol: string;
  quantity: number;
  availableQty: number;
  exitPrice: number;
  lots: LotPlan[];
  totalTaxOptimal: number;
  totalTaxFIFO: number;
  totalTaxSaved: number;
  strategy: string;
  note: string;
}

interface Props {
  symbol: string;
  defaultQuantity?: number;
  onClose: () => void;
}

function fmtINR(n: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function TaxLotOptimizerModal({ symbol, defaultQuantity = 1, onClose }: Props) {
  const [qty, setQty] = useState<number>(defaultQuantity || 1);
  const [data, setData] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (q: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/tax-optimizer/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, quantity: q }),
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message || 'Failed');
      setData(json.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to compute');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(qty); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const totalGain = data?.lots.reduce((s, l) => s + l.gain, 0) ?? 0;
  const isProfit = totalGain >= 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Tax-Lot Optimizer · {symbol}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Advisory only — helps minimize tax when exiting. FY26 rates.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quantity control */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-xs text-gray-600">Shares to sell:</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
            className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px] sm:min-h-0"
          />
          <button
            onClick={() => run(qty)}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Recompute'}
          </button>
          {data && <span className="text-[11px] text-gray-500 ml-auto">Available: {data.availableQty}</span>}
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-start gap-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {data && data.note && (
          <div className="rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 mb-3">{data.note}</div>
        )}

        {data && data.lots.length > 0 && (
          <>
            {/* Savings summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="rounded-lg bg-indigo-50 p-2.5 border border-indigo-200">
                <p className="text-[10px] uppercase text-indigo-600">Strategy</p>
                <p className="text-xs font-bold text-indigo-900">{data.strategy}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                <p className="text-[10px] uppercase text-gray-500">Exit Price</p>
                <p className="text-sm font-bold font-mono">{fmtINR(data.exitPrice)}</p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-gray-200">
                <p className="text-[10px] uppercase text-gray-500">Tax (FIFO)</p>
                <p className="text-sm font-bold font-mono text-red-600">{fmtINR(data.totalTaxFIFO)}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2.5 border border-green-200">
                <p className="text-[10px] uppercase text-green-700">Tax (Optimal)</p>
                <p className="text-sm font-bold font-mono text-green-700">{fmtINR(data.totalTaxOptimal)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-emerald-200 p-3 mb-4">
              <div className="flex items-center gap-2">
                {isProfit ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                )}
                <p className="text-sm font-semibold text-emerald-900">
                  Estimated tax saved: {fmtINR(Math.max(0, data.totalTaxSaved))}
                </p>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                vs selling in FIFO order (oldest lots first, the default many brokers use).
              </p>
            </div>

            {/* Lot breakdown */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase">#</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase">Buy Date</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase">Buy ₹</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase">Gain</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.lots.map((l, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                        <td className="px-2 py-1.5 text-gray-700">
                          {new Date(l.buyDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-800">{l.quantity}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-800">{fmtINR(l.buyPrice)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            l.taxCategory === 'LTCG'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {l.taxCategory}
                          </span>
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono ${l.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtINR(l.gain)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-red-600">{fmtINR(l.estimatedTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-3">
              Rates: STCG {"<"} 12 mo — 15% · LTCG ≥ 12 mo — 10% (first ₹1L/yr exempt, not applied here). Data from your TradeSetups + imported holdings.
            </p>
          </>
        )}

        {data && data.lots.length === 0 && !loading && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600 text-center">
            {data.note || 'No buy-lots available for this symbol.'}
          </div>
        )}
      </div>
    </div>
  );
}
