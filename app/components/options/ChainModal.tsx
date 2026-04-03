'use client';

import React, { useMemo } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { Strike, StrategyLeg, OptionChainData } from './types';
import { isATM, isITM, legExists, formatNum } from './utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  chain: OptionChainData | null;
  visibleStrikes: Strike[];
  spotPrice: number;
  strikeStep: number;
  legs: StrategyLeg[];
  onAddLeg: (strike: Strike, type: 'CE' | 'PE', side: 'BUY' | 'SELL') => void;
  onRemoveLeg: (id: string) => void;
  expiries: string[];
  selectedExpiry: string;
  onSelectExpiry: (e: string) => void;
  lotSize: number;
}

export default function ChainModal({
  isOpen, onClose, chain, visibleStrikes, spotPrice, strikeStep,
  legs, onAddLeg, onRemoveLeg, expiries, selectedExpiry, onSelectExpiry, lotSize,
}: Props) {
  if (!isOpen) return null;

  const maxCEOI = useMemo(() => Math.max(...(visibleStrikes.length ? visibleStrikes.map(s => s.ce.oi) : [1]), 1), [visibleStrikes]);
  const maxPEOI = useMemo(() => Math.max(...(visibleStrikes.length ? visibleStrikes.map(s => s.pe.oi) : [1]), 1), [visibleStrikes]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative ml-auto w-full max-w-4xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Option Chain</h3>
            <span className="text-sm text-gray-500">{chain?.underlying}</span>
            <select
              value={selectedExpiry}
              onChange={e => onSelectExpiry(e.target.value)}
              className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 outline-none"
            >
              {expiries.map(ex => (
                <option key={ex} value={ex}>{new Date(ex).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</option>
              ))}
            </select>
            {chain && (
              <span className="text-xs text-gray-400">PCR: {chain.pcr}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Chain table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
              <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                <th className="py-2 px-1 text-center w-8"></th>
                <th className="py-2 px-1 text-right">OI</th>
                <th className="py-2 px-1 text-right">Vol</th>
                <th className="py-2 px-1 text-right">IV</th>
                <th className="py-2 px-1 text-right">LTP</th>
                <th className="py-2 px-2 text-center font-semibold text-gray-600 dark:text-gray-300 text-sm">Strike</th>
                <th className="py-2 px-1 text-left">LTP</th>
                <th className="py-2 px-1 text-left">IV</th>
                <th className="py-2 px-1 text-left">Vol</th>
                <th className="py-2 px-1 text-left">OI</th>
                <th className="py-2 px-1 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {visibleStrikes.map(s => {
                const atm = isATM(s.strike, spotPrice, strikeStep);
                const ceITM = isITM(s.strike, spotPrice, 'CE');
                const peITM = isITM(s.strike, spotPrice, 'PE');
                const ceLegId = legs.find(l => l.strike === s.strike && l.type === 'CE')?.id;
                const peLegId = legs.find(l => l.strike === s.strike && l.type === 'PE')?.id;

                return (
                  <tr
                    key={s.strike}
                    className={`border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${
                      atm ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                    }`}
                  >
                    {/* CE Add/Remove */}
                    <td className="py-1.5 px-1 text-center">
                      {ceLegId ? (
                        <button onClick={() => onRemoveLeg(ceLegId)} className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto">
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button onClick={() => onAddLeg(s, 'CE', 'SELL')} className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center mx-auto text-gray-400 hover:text-green-500">
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </td>

                    {/* CE side */}
                    <td className={`py-1.5 px-1 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                      <div>{formatNum(s.ce.oi, 0)}</div>
                      {s.ce.oi > 0 && <div className="h-0.5 rounded-full bg-green-400/70 ml-auto mt-0.5" style={{ width: `${Math.min(100, Math.round((s.ce.oi / maxCEOI) * 100))}%` }} />}
                    </td>
                    <td className={`py-1.5 px-1 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{formatNum(s.ce.volume, 0)}</td>
                    <td className={`py-1.5 px-1 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{(s.ce.iv * 100).toFixed(1)}</td>
                    <td className={`py-1.5 px-1 text-right font-mono-nums font-semibold ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.ltp.toFixed(1)}</td>

                    {/* Strike */}
                    <td className={`py-1.5 px-2 text-center font-mono-nums font-bold text-sm ${atm ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {s.strike.toLocaleString('en-IN')}
                      {atm && <div className="text-[8px] font-normal text-blue-500 leading-none mt-0.5">ATM</div>}
                    </td>

                    {/* PE side */}
                    <td className={`py-1.5 px-1 text-left font-mono-nums font-semibold ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.ltp.toFixed(1)}</td>
                    <td className={`py-1.5 px-1 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{(s.pe.iv * 100).toFixed(1)}</td>
                    <td className={`py-1.5 px-1 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{formatNum(s.pe.volume, 0)}</td>
                    <td className={`py-1.5 px-1 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                      <div>{formatNum(s.pe.oi, 0)}</div>
                      {s.pe.oi > 0 && <div className="h-0.5 rounded-full bg-red-400/70 mr-auto mt-0.5" style={{ width: `${Math.min(100, Math.round((s.pe.oi / maxPEOI) * 100))}%` }} />}
                    </td>

                    {/* PE Add/Remove */}
                    <td className="py-1.5 px-1 text-center">
                      {peLegId ? (
                        <button onClick={() => onRemoveLeg(peLegId)} className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto">
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button onClick={() => onAddLeg(s, 'PE', 'SELL')} className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center mx-auto text-gray-400 hover:text-red-500">
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500">
            {legs.length} legs selected · Lot size: {lotSize}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
