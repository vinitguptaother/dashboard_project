'use client';

/**
 * PortfolioAnalyzerSection — Phase 2 Track C
 *
 * Upload a broker CSV (Zerodha / Upstox / Groww) and get an AI verdict for
 * each holding: GOOD / AVERAGE / BAD + BUY / HOLD / SELL with detailed
 * reasoning.
 *
 * Backend: /api/portfolio-analyzer/*
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Upload,
  Sparkles,
  Trash2,
  X,
  Download,
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

type VerdictGrade = 'GOOD' | 'AVERAGE' | 'BAD';
type VerdictRating = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
type VerdictSource = 'claude' | 'perplexity' | 'placeholder';

interface VerdictFactor {
  name: string;
  score: number;
  weight: number;
  note: string;
}

interface StockVerdict {
  symbol: string;
  verdict: VerdictRating;
  grade: VerdictGrade;
  confidence: number;
  summary: string;
  detailedReasoning: string;
  factors: VerdictFactor[];
  source: VerdictSource;
  generatedAt: string;
  expiresAt: string;
}

interface Holding {
  _id: string;
  symbol: string;
  company: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  source: string;
  importedAt: string;
}

interface HoldingsResponse {
  status: string;
  count: number;
  totals: { invested: number; currentValue: number; pnl: number; pnlPct: number };
  aiAvailable: boolean;
  holdings: Holding[];
}

interface UploadResponse {
  status: string;
  imported?: number;
  skipped?: number;
  message?: string;
  holdings?: Holding[];
}

interface AnalyzeAllResponse {
  status: string;
  count: number;
  aiAvailable: boolean;
  placeholderCount: number;
  rows: Array<{ holding: Holding; verdict: StockVerdict }>;
  message?: string;
}

interface VerdictResponse {
  status: string;
  verdict: StockVerdict;
  message?: string;
}

const SAMPLE_CSV = `Symbol,Qty,Avg Price,LTP,Current Value,P&L
RELIANCE,10,2800,2850,28500,500
HDFCBANK,5,1500,1520,7600,100
INFY,15,1450,1500,22500,750`;

function fmtINR(n: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

const verdictBadgeClass: Record<VerdictRating, string> = {
  STRONG_BUY: 'bg-green-600 text-white border-green-700',
  BUY: 'bg-green-100 text-green-800 border-green-300',
  HOLD: 'bg-amber-100 text-amber-800 border-amber-300',
  SELL: 'bg-red-100 text-red-700 border-red-300',
  STRONG_SELL: 'bg-red-600 text-white border-red-700',
};

const gradeBadgeClass: Record<VerdictGrade, string> = {
  GOOD: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  AVERAGE: 'bg-gray-100 text-gray-700 border-gray-300',
  BAD: 'bg-rose-100 text-rose-700 border-rose-300',
};

interface PortfolioAnalyzerSectionProps {
  onHide?: () => void;
}

export default function PortfolioAnalyzerSection(
  props: PortfolioAnalyzerSectionProps,
): ReactElement {
  const { onHide } = props;

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, StockVerdict>>({});
  const [totals, setTotals] = useState<HoldingsResponse['totals']>({
    invested: 0,
    currentValue: 0,
    pnl: 0,
    pnlPct: 0,
  });
  const [aiAvailable, setAiAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [infoBanner, setInfoBanner] = useState('');
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchHoldings = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/portfolio-analyzer/holdings`);
      const json = (await res.json()) as HoldingsResponse;
      if (json.status === 'success') {
        setHoldings(json.holdings || []);
        setTotals(json.totals);
        setAiAvailable(json.aiAvailable);
      }
    } catch (err) {
      console.error('Failed to fetch holdings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const uploadCSV = useCallback(
    async (csvText: string): Promise<void> => {
      if (!csvText.trim()) {
        setUploadError('CSV is empty');
        return;
      }
      setUploading(true);
      setUploadError('');
      setInfoBanner('');
      try {
        const res = await fetch(`${BACKEND_URL}/api/portfolio-analyzer/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvText }),
        });
        const json = (await res.json()) as UploadResponse;
        if (json.status === 'success') {
          setInfoBanner(
            `Imported ${json.imported ?? 0} holdings${json.skipped ? ` (${json.skipped} skipped)` : ''}. Click "Analyze all" to get AI verdicts.`,
          );
          setShowPaste(false);
          setPasteValue('');
          setVerdicts({});
          await fetchHoldings();
        } else {
          setUploadError(json.message || 'Upload failed');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setUploadError(msg);
      } finally {
        setUploading(false);
      }
    },
    [fetchHoldings],
  );

  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        setUploadError('Please upload a .csv file');
        return;
      }
      const text = await file.text();
      await uploadCSV(text);
    },
    [uploadCSV],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const analyzeAll = useCallback(async (): Promise<void> => {
    if (holdings.length === 0) return;
    setAnalyzingAll(true);
    setInfoBanner(`Analyzing ${holdings.length} holdings — this may take ~${holdings.length}s...`);
    try {
      const res = await fetch(`${BACKEND_URL}/api/portfolio-analyzer/analyze-all`, {
        method: 'POST',
      });
      const json = (await res.json()) as AnalyzeAllResponse;
      if (json.status === 'success') {
        const map: Record<string, StockVerdict> = {};
        (json.rows || []).forEach(r => {
          map[r.verdict.symbol] = r.verdict;
        });
        setVerdicts(map);
        setAiAvailable(json.aiAvailable);
        if (!json.aiAvailable || (json.placeholderCount && json.placeholderCount > 0)) {
          setInfoBanner(
            `Analyzed ${json.count} holdings. ${json.placeholderCount || 0} returned placeholder verdicts (AI key missing or call failed).`,
          );
        } else {
          setInfoBanner(`Analyzed ${json.count} holdings with AI verdicts.`);
        }
      } else {
        setUploadError(json.message || 'Analysis failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setUploadError(msg);
    } finally {
      setAnalyzingAll(false);
    }
  }, [holdings.length]);

  const analyzeOne = useCallback(async (symbol: string): Promise<void> => {
    setAnalyzingSymbol(symbol);
    try {
      const res = await fetch(`${BACKEND_URL}/api/portfolio-analyzer/verdict/${encodeURIComponent(symbol)}`);
      const json = (await res.json()) as VerdictResponse;
      if (json.status === 'success' && json.verdict) {
        setVerdicts(prev => ({ ...prev, [symbol]: json.verdict }));
      }
    } catch (err) {
      console.error('Verdict fetch failed:', err);
    } finally {
      setAnalyzingSymbol(null);
    }
  }, []);

  const clearAll = useCallback(async (): Promise<void> => {
    if (!confirm('Remove all imported holdings? Your broker data stays safe.')) return;
    try {
      await fetch(`${BACKEND_URL}/api/portfolio-analyzer/holdings`, { method: 'DELETE' });
      setHoldings([]);
      setVerdicts({});
      setTotals({ invested: 0, currentValue: 0, pnl: 0, pnlPct: 0 });
      setInfoBanner('');
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }, []);

  const downloadSample = useCallback((): void => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const modalVerdict = useMemo<StockVerdict | null>(() => {
    if (!modalSymbol) return null;
    return verdicts[modalSymbol] || null;
  }, [modalSymbol, verdicts]);

  const modalHolding = useMemo<Holding | null>(() => {
    if (!modalSymbol) return null;
    return holdings.find(h => h.symbol === modalSymbol) || null;
  }, [modalSymbol, holdings]);

  return (
    <div className="space-y-4 slide-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Portfolio Analyzer
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Upload your broker CSV. AI gives a GOOD / AVERAGE / BAD verdict and BUY / HOLD / SELL recommendation for each stock.
          </p>
        </div>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="text-gray-400 hover:text-gray-600 text-xs underline"
          >
            Hide analyzer
          </button>
        )}
      </div>

      {!aiAvailable && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            AI verdicts require <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code>{' '}
            in <code className="font-mono bg-amber-100 px-1 rounded">backend/.env</code>. Without it, verdicts return &quot;AI unavailable&quot; placeholders.
          </span>
        </div>
      )}

      {infoBanner && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {infoBanner}
        </div>
      )}

      {uploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-center justify-between">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-gray-800">
            Drag &amp; drop a CSV from Zerodha / Upstox / Groww
          </p>
          <p className="text-xs text-gray-500 mt-1">or use one of the options below</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Choose CSV file'}
            </button>
            <button
              type="button"
              onClick={() => setShowPaste(p => !p)}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors"
            >
              {showPaste ? 'Cancel paste' : 'Paste CSV text'}
            </button>
            <button
              type="button"
              onClick={downloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Sample CSV
            </button>
            <button
              type="button"
              disabled
              title="Upstox live fetch coming soon"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-400 text-xs font-semibold cursor-not-allowed"
            >
              Fetch from Upstox (soon)
            </button>
          </div>

          {showPaste && (
            <div className="w-full mt-3">
              <textarea
                value={pasteValue}
                onChange={e => setPasteValue(e.target.value)}
                rows={6}
                placeholder="Paste CSV rows here (first row = headers). Example:\nSymbol,Qty,Avg Price,LTP,Current Value,P&L\nRELIANCE,10,2800,2850,28500,500"
                className="w-full p-2 text-xs font-mono border rounded-lg bg-white focus:ring-2 focus:ring-blue-300 outline-none"
              />
              <button
                type="button"
                onClick={() => void uploadCSV(pasteValue)}
                disabled={uploading || !pasteValue.trim()}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {uploading ? 'Uploading...' : 'Import pasted CSV'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Totals + actions */}
      {holdings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white border border-gray-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Invested</p>
              <p className="text-sm font-bold text-gray-900 font-mono">{fmtINR(totals.invested)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Current</p>
              <p className="text-sm font-bold text-gray-900 font-mono">{fmtINR(totals.currentValue)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">P&amp;L</p>
              <p className={`text-sm font-bold font-mono ${totals.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtINR(totals.pnl)} ({fmtPct(totals.pnlPct)})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void analyzeAll()}
              disabled={analyzingAll || holdings.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
            >
              {analyzingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzingAll ? 'Analyzing...' : 'Analyze all'}
            </button>
            <button
              type="button"
              onClick={() => void clearAll()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-700 hover:text-red-700 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Holdings table */}
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-500">Loading holdings...</div>
      ) : holdings.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No holdings imported yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Upload your portfolio CSV from Zerodha / Upstox / Groww to get AI verdicts.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Symbol</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Buy ₹</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Current ₹</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">P&amp;L</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">P&amp;L %</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Verdict</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Grade</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holdings.map(h => {
                  const v = verdicts[h.symbol];
                  const pnlClass = h.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600';
                  return (
                    <tr
                      key={h._id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setModalSymbol(h.symbol)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-semibold text-blue-700 text-sm">{h.symbol}</div>
                        {h.company && <div className="text-xs text-gray-400 truncate max-w-[160px]">{h.company}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-mono text-gray-800">{h.quantity}</td>
                      <td className="px-3 py-2 text-right text-sm font-mono text-gray-800">{fmtINR(h.avgBuyPrice)}</td>
                      <td className="px-3 py-2 text-right text-sm font-mono text-gray-800">{fmtINR(h.currentPrice)}</td>
                      <td className={`px-3 py-2 text-right text-sm font-mono font-semibold ${pnlClass}`}>
                        <span className="inline-flex items-center gap-0.5">
                          {h.unrealizedPnL >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmtINR(h.unrealizedPnL)}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right text-sm font-mono font-semibold ${pnlClass}`}>
                        {fmtPct(h.unrealizedPnLPct)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {v ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${verdictBadgeClass[v.verdict]}`}
                          >
                            {v.verdict.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {v ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${gradeBadgeClass[v.grade]}`}
                          >
                            {v.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); void analyzeOne(h.symbol); }}
                          disabled={analyzingSymbol === h.symbol}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 text-[11px] font-semibold transition-colors"
                        >
                          {analyzingSymbol === h.symbol ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Analyze
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalSymbol && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setModalSymbol(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{modalSymbol}</h3>
                {modalHolding?.company && (
                  <p className="text-sm text-gray-500">{modalHolding.company}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalSymbol(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalHolding && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">Qty</p>
                  <p className="text-sm font-bold font-mono">{modalHolding.quantity}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">Avg Buy</p>
                  <p className="text-sm font-bold font-mono">{fmtINR(modalHolding.avgBuyPrice)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">Current</p>
                  <p className="text-sm font-bold font-mono">{fmtINR(modalHolding.currentPrice)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">Invested</p>
                  <p className="text-sm font-bold font-mono">{fmtINR(modalHolding.investedValue)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">Value</p>
                  <p className="text-sm font-bold font-mono">{fmtINR(modalHolding.currentValue)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
                  <p className="text-[10px] uppercase text-gray-500">P&amp;L</p>
                  <p className={`text-sm font-bold font-mono ${modalHolding.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmtINR(modalHolding.unrealizedPnL)} ({fmtPct(modalHolding.unrealizedPnLPct)})
                  </p>
                </div>
              </div>
            )}

            {modalVerdict ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${verdictBadgeClass[modalVerdict.verdict]}`}
                  >
                    {modalVerdict.verdict.replace('_', ' ')}
                  </span>
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${gradeBadgeClass[modalVerdict.grade]}`}
                  >
                    {modalVerdict.grade}
                  </span>
                  <span className="text-xs text-gray-500">
                    Confidence: <strong className="text-gray-800">{modalVerdict.confidence}%</strong>
                  </span>
                  <span className="text-xs text-gray-400">
                    · {modalVerdict.source === 'claude' ? 'AI: Claude' : 'Placeholder'}
                  </span>
                </div>

                {modalVerdict.summary && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Summary</p>
                    <p className="text-sm text-gray-800">{modalVerdict.summary}</p>
                  </div>
                )}

                {modalVerdict.detailedReasoning && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Detailed Reasoning</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{modalVerdict.detailedReasoning}</p>
                  </div>
                )}

                {modalVerdict.factors && modalVerdict.factors.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Factor Breakdown</p>
                    <div className="space-y-1.5">
                      {modalVerdict.factors.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-32 shrink-0 font-medium text-gray-700">{f.name}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden relative">
                            <div
                              className={`h-full ${f.score >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                              style={{
                                width: `${Math.abs(f.score) / 2}%`,
                                marginLeft: f.score >= 0 ? '50%' : `${50 - Math.abs(f.score) / 2}%`,
                              }}
                            />
                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300" />
                          </div>
                          <span className="w-10 text-right font-mono text-gray-600">{f.score}</span>
                          <span className="w-8 text-right text-gray-400">×{f.weight}</span>
                          {f.note && <span className="flex-1 text-gray-500 truncate" title={f.note}>{f.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-3">No AI verdict yet for this stock.</p>
                <button
                  type="button"
                  onClick={() => void analyzeOne(modalSymbol)}
                  disabled={analyzingSymbol === modalSymbol}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {analyzingSymbol === modalSymbol ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Analyze now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
