'use client';

import { useState, useEffect } from 'react';
import { Layers, Upload, FileText, TrendingUp, X, Sparkles, Award, Plus, Pencil, Trash2, Clock, RotateCcw, BarChart3, Target, ShieldAlert, ArrowUpRight, ArrowDownRight, Zap, Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ScreenDefinition, ScreenBatch, ScreenId, ScreenSymbol } from '../types/screens';
import * as XLSX from 'xlsx';

const BACKEND_URL = 'http://localhost:5002';

interface AIBreakdown {
  health: number;
  growth: number;
  valuation: number;
  technical: number;
  orderFlow: number;
  institutional: number;
  reason: string;
}

interface RankedSymbol {
  symbol: string;
  lastPrice: number | null;
  prevClose: number | null;
  percentChange: number | null;
  score: number;
  aiScore?: number;
  aiBreakdown?: AIBreakdown | null;
  error?: string;
}

interface TradeSetup {
  _id?: string;
  symbol: string;
  tradeType: 'SWING' | 'INVESTMENT';
  action: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
  entryPrice: number;
  stopLoss: number;
  target: number;
  currentPrice: number | null;
  holdingDuration: string;
  riskRewardRatio: string;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  status?: string;
}

interface PreviousBatchSummary {
  _id: string;
  runDate: string;
  screenName: string;
  batchSize: number;
}

interface ApiScreen {
  _id: string;
  name: string;
  description: string;
  query: string;
  isDefault: boolean;
}

const toScreenDefinition = (s: ApiScreen): ScreenDefinition => ({
  id: s._id,
  name: s.name,
  shortDescription: s.description || '',
  queryText: s.query || '',
  isActive: true,
});

const ScreensTab = () => {
  const [screens, setScreens] = useState<ScreenDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<ScreenBatch[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<ScreenId | null>(null);
  const [editableQueryText, setEditableQueryText] = useState<string>('');
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
  const [modalData, setModalData] = useState({ name: '', shortDescription: '', queryText: '' });
  const [savingScreen, setSavingScreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvParsedStocks, setCsvParsedStocks] = useState<{symbol: string, name: string}[]>([]);
  const [localBatchStocks, setLocalBatchStocks] = useState<{symbol: string, name: string}[]>([]);
  const [lastImportInfo, setLastImportInfo] = useState<{date: string, count: number} | null>(null);
  const [rankedResults, setRankedResults] = useState<RankedSymbol[]>([]);
  const [isRanking, setIsRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [previousBatches, setPreviousBatches] = useState<PreviousBatchSummary[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<{screens: {screenName: string, totalBatches: number, overallHitRate: number, overallAvgReturn: number}[]} | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [tradeSetups, setTradeSetups] = useState<TradeSetup[]>([]);
  const [isGeneratingSetups, setIsGeneratingSetups] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupCount, setSetupCount] = useState(5); // How many top stocks to generate setups for
  const [duplicateInfo, setDuplicateInfo] = useState<{updated: any[], skipped: any[]}>({ updated: [], skipped: [] });
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // ── Screener.in Auto-Fetch state (v2) ─────────────────────────────────────
  const [screenerConnected, setScreenerConnected] = useState(false);
  const [screenerEmail, setScreenerEmail] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchedCompanies, setFetchedCompanies] = useState<{name: string, symbol: string}[]>([]);
  const [fetchedScreenName, setFetchedScreenName] = useState('');
  const [alreadyImportedToday, setAlreadyImportedToday] = useState(false);
  const [onlyLatestResults, setOnlyLatestResults] = useState(true);
  const [autoPipeline, setAutoPipeline] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  useEffect(() => { fetchScreens(); fetchPerformance(); fetchRecommendations(); checkScreenerStatus(); }, []);

  const checkScreenerStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/screener-status`);
      const json = await res.json();
      if (json.status === 'success') {
        setScreenerConnected(json.data.connected);
        setScreenerEmail(json.data.email || '');
      }
    } catch { /* backend down — ignore */ }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('screenBatch');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setLocalBatchStocks(parsed);
      }
      const info = localStorage.getItem('screenBatchImportInfo');
      if (info) setLastImportInfo(JSON.parse(info));
    } catch (e) {
      console.error('Failed to load batch from localStorage:', e);
    }
  }, []);

  const fetchScreens = async () => {
    try {
      setLoading(true);
      const res = await fetch(BACKEND_URL + '/api/screens');
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        const mapped = json.data.map(toScreenDefinition);
        setScreens(mapped);
        if (mapped.length > 0) {
          setSelectedScreenId(mapped[0].id);
          setEditableQueryText(mapped[0].queryText);
        }
      }
    } catch (err) {
      console.error('Failed to load screens:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    setLoadingPerformance(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/performance`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setPerformanceData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/recommendations`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setRecommendations(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoadingRecs(false);
    }
  };

  // Fetch previous batches when selected screen changes or after ranking
  useEffect(() => {
    if (!selectedScreenId) {
      setPreviousBatches([]);
      return;
    }
    const fetchBatches = async () => {
      setLoadingBatches(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/screens/${selectedScreenId}/batches`);
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          setPreviousBatches(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch previous batches:', err);
      } finally {
        setLoadingBatches(false);
      }
    };
    fetchBatches();
  }, [selectedScreenId, rankedResults]);

  const selectedScreen = screens.find(s => s.id === selectedScreenId);
  const currentBatch = batches
    .filter(b => b.screenId === selectedScreenId)
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];

  const handleSelectScreen = (screenId: ScreenId) => {
    setSelectedScreenId(screenId);
    const screen = screens.find(s => s.id === screenId);
    if (screen) setEditableQueryText(screen.queryText);
    // Clear previous screen's data to avoid stale state
    setLocalBatchStocks([]);
    setRankedResults([]);
    setTradeSetups([]);
    setRankingError(null);
    setSetupError(null);
    setSaveWarning(null);
    setPipelineStatus(null);
    setPipelineRunning(false);
    setFetchError(null);
    setLastImportInfo(null);
    localStorage.removeItem('screenBatch');
    localStorage.removeItem('screenBatchImportInfo');
  };

  const handleAddScreen = () => {
    setModalMode('add');
    setEditingScreenId(null);
    setModalData({ name: '', shortDescription: '', queryText: '' });
    setShowScreenModal(true);
  };

  const handleEditScreen = (screen: ScreenDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditingScreenId(screen.id);
    setModalData({ name: screen.name, shortDescription: screen.shortDescription, queryText: screen.queryText });
    setShowScreenModal(true);
  };

  const handleDeleteScreen = async (screen: ScreenDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${screen.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/${screen.id}`, { method: 'DELETE' });
      if (res.ok) { await fetchScreens(); setSelectedScreenId(null); }
      else alert('Failed to delete. Please try again.');
    } catch (err) { console.error('Delete error:', err); }
  };

  const handleSaveScreen = async () => {
    if (!modalData.name.trim()) { alert('Screen name is required.'); return; }
    setSavingScreen(true);
    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit ? `${BACKEND_URL}/api/screens/${editingScreenId}` : `${BACKEND_URL}/api/screens`;
      const method = isEdit ? 'PUT' : 'POST';
      const body = { name: modalData.name.trim(), description: modalData.shortDescription.trim(), query: modalData.queryText.trim() };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setShowScreenModal(false); await fetchScreens(); }
      else { const err = await res.json(); alert(`Failed to save: ${err.message || 'Unknown error'}`); }
    } catch (err) { console.error('Save error:', err); alert('Failed to save screen. Please try again.'); }
    finally { setSavingScreen(false); }
  };

  const handleOpenUploadModal = () => {
    setCsvFileName('');
    setCsvParsedStocks([]);
    setShowUploadModal(true);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvParsedStocks([]);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
        if (rows.length === 0) { setCsvParsedStocks([]); return; }
        const colNames = Object.keys(rows[0]);
        const findCol = (targets: string[]) => colNames.find(c => targets.includes(c.toLowerCase().trim()));
        const symbolCol = findCol(['symbol', 'ticker', 'nse symbol']);
        const nameCol = findCol(['name']);
        const stocks: {symbol: string, name: string}[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
          let sym = '';
          let name = '';
          if (symbolCol) {
            sym = String(row[symbolCol] || '').trim().toUpperCase();
            name = nameCol ? String(row[nameCol] || '').trim() : '';
          } else if (nameCol) {
            const val = String(row[nameCol] || '').trim();
            sym = val.toUpperCase();
            name = val;
          } else {
            sym = String(Object.values(row)[0] || '').trim().toUpperCase();
          }
          if (sym && !seen.has(sym)) {
            seen.add(sym);
            stocks.push({ symbol: sym, name });
          }
        }
        setCsvParsedStocks(stocks);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvParsedStocks([]); return; }
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const symbolIdx = headers.indexOf('symbol') !== -1
          ? headers.indexOf('symbol')
          : headers.indexOf('ticker') !== -1
            ? headers.indexOf('ticker')
            : headers.indexOf('nse symbol') !== -1
              ? headers.indexOf('nse symbol')
              : 0;
        const nameIdx = headers.indexOf('name');
        const stocks: {symbol: string, name: string}[] = [];
        const seen = new Set<string>();
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const sym = cols[symbolIdx]?.trim().toUpperCase();
          if (sym && !seen.has(sym)) {
            seen.add(sym);
            stocks.push({ symbol: sym, name: nameIdx >= 0 ? cols[nameIdx]?.trim() || '' : '' });
          }
        }
        setCsvParsedStocks(stocks);
      };
      reader.readAsText(file);
    }
  };

  const handleSaveBatch = () => {
    if (csvParsedStocks.length === 0) { alert('No stocks found in the file.'); return; }
    localStorage.setItem('screenBatch', JSON.stringify(csvParsedStocks));
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const importInfo = { date: dateStr, count: csvParsedStocks.length };
    localStorage.setItem('screenBatchImportInfo', JSON.stringify(importInfo));
    setLocalBatchStocks(csvParsedStocks);
    setLastImportInfo(importInfo);
    const screenSymbols: ScreenSymbol[] = csvParsedStocks.map(s => ({ symbol: s.symbol, name: s.name, sector: undefined, marketCap: undefined }));
    const newBatch: ScreenBatch = { id: Date.now().toString(), screenId: selectedScreenId || '', importedAt: now.toISOString(), symbols: screenSymbols };
    setBatches(prev => [...prev, newBatch]);
    setShowUploadModal(false);
    setCsvFileName('');
    setCsvParsedStocks([]);
  };

  const handleCancelUpload = () => {
    setShowUploadModal(false);
    setCsvFileName('');
    setCsvParsedStocks([]);
  };

  // ── Screener.in Auto-Fetch handlers (v2) ─────────────────────────────────
  const handleScreenerLogin = async () => {
    if (!loginEmail || !loginPassword) { setFetchError('Enter email and password'); return; }
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/screener-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setScreenerConnected(true);
        setScreenerEmail(loginEmail);
        setShowLoginModal(false);
        setLoginPassword('');
      } else {
        setFetchError(json.message || 'Login failed');
      }
    } catch (e: any) {
      setFetchError(e.message || 'Could not reach backend');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleScreenerLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/screens/screener-logout`, { method: 'POST' });
    } catch {}
    setScreenerConnected(false);
    setScreenerEmail('');
  };

  const handleFetchFromScreener = async () => {
    const selectedScreen = screens.find(s => s.id === selectedScreenId);
    if (!selectedScreen) return;
    const query = editableQueryText || selectedScreen.queryText;
    if (!query || !query.trim()) {
      alert('This screen has no Screener Query set. Add a query first (e.g. "Market Cap > 1000 AND PE Ratio < 20").');
      return;
    }
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/screener-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), screenName: selectedScreen.name, onlyLatestResults }),
      });
      const json = await res.json();
      if (json.status === 'success' && json.data?.companies) {
        setFetchedCompanies(json.data.companies);
        setFetchedScreenName(selectedScreen.name);
        setAlreadyImportedToday(json.data.alreadyImportedToday || false);
        setShowFetchModal(true);
      } else {
        setFetchError(json.message || 'Failed to fetch');
        // If 401 (creds expired), reset connected status
        if (res.status === 401) { setScreenerConnected(false); setScreenerEmail(''); }
      }
    } catch (e: any) {
      setFetchError(e.message || 'Network error');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleImportFetched = () => {
    if (fetchedCompanies.length === 0) return;
    const stocks = fetchedCompanies.map(c => ({ symbol: c.symbol, name: c.name }));
    localStorage.setItem('screenBatch', JSON.stringify(stocks));
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const importInfo = { date: dateStr, count: stocks.length };
    localStorage.setItem('screenBatchImportInfo', JSON.stringify(importInfo));
    setLocalBatchStocks(stocks);
    setLastImportInfo(importInfo);
    const screenSymbols: ScreenSymbol[] = stocks.map(s => ({ symbol: s.symbol, name: s.name, sector: undefined, marketCap: undefined }));
    const newBatch: ScreenBatch = { id: Date.now().toString(), screenId: selectedScreenId || '', importedAt: now.toISOString(), symbols: screenSymbols };
    setBatches(prev => [...prev, newBatch]);
    setShowFetchModal(false);
    setFetchedCompanies([]);

    // Auto-pipeline: rank → generate setups → saved to paper trade automatically
    if (autoPipeline && stocks.length > 0) {
      runAutoPipeline(stocks);
    }
  };

  const runAutoPipeline = async (stocks: {symbol: string, name: string}[]) => {
    const screen = screens.find(s => s.id === selectedScreenId);
    setPipelineRunning(true);
    setPipelineStatus('Step 1/3: AI Ranking stocks...');
    setIsRanking(true);
    setRankingError(null);
    setRankedResults([]);
    setTradeSetups([]);
    setSetupError(null);

    try {
      // Step 1: Rank
      const symbols = stocks.map(s => s.symbol);
      const rankRes = await fetch(`${BACKEND_URL}/api/screens/rankBatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });
      if (!rankRes.ok) throw new Error(`Ranking failed: ${rankRes.status}`);
      const rankResult = await rankRes.json();
      if (rankResult.status !== 'success' || !Array.isArray(rankResult.data?.ranked)) {
        throw new Error(rankResult.message || 'Invalid ranking response');
      }
      const sorted = [...rankResult.data.ranked].sort((a: RankedSymbol, b: RankedSymbol) => b.score - a.score);
      setRankedResults(sorted);
      setIsRanking(false);

      // Save batch to DB
      setPipelineStatus('Step 2/3: Saving batch to database...');
      try {
        await fetch(`${BACKEND_URL}/api/screens/saveBatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenId: screen?.id || null,
            screenName: screen?.name || 'Unnamed Screen',
            symbols,
            rankedResults: sorted,
          })
        });
      } catch {}

      // Step 3: Generate trade setups for top N
      setPipelineStatus(`Step 3/3: Generating AI trade setups for top ${setupCount} stocks...`);
      setIsGeneratingSetups(true);
      const topSymbols = sorted.slice(0, setupCount).map((r: RankedSymbol) => r.symbol);
      const setupRes = await fetch(`${BACKEND_URL}/api/trade-setup/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: topSymbols,
          screenBatchId: null,
          screenName: screen?.name || 'Unknown Screen',
        }),
      });
      if (!setupRes.ok) throw new Error(`Setup generation failed: ${setupRes.status}`);
      const setupResult = await setupRes.json();
      if (setupResult.status === 'success' && setupResult.data) {
        const newSetups = Array.isArray(setupResult.data.setups) ? setupResult.data.setups : [];
        const updated = Array.isArray(setupResult.data.updated) ? setupResult.data.updated : [];
        const skipped = Array.isArray(setupResult.data.skipped) ? setupResult.data.skipped : [];
        setTradeSetups(newSetups);
        setDuplicateInfo({ updated, skipped });
        setPipelineStatus(`✅ Done! ${sorted.length} ranked, ${newSetups.length} new setups saved to Paper Trade, ${updated.length} updated, ${skipped.length} skipped.`);
      } else {
        throw new Error(setupResult.message || 'Invalid setup response');
      }
    } catch (error: any) {
      setPipelineStatus(`❌ Pipeline error: ${error.message}`);
      setRankingError(error.message);
    } finally {
      setIsRanking(false);
      setIsGeneratingSetups(false);
      setPipelineRunning(false);
    }
  };

  const handleCloseFetchModal = () => {
    setShowFetchModal(false);
    setFetchError(null);
    setFetchedCompanies([]);
  };

  const handleDeleteBatch = async (batchId: string, screenName: string) => {
    if (!confirm(`Delete batch from "${screenName}"? This will also delete all trade setups generated from this batch.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/batch/${batchId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status === 'success') {
        setPreviousBatches(prev => prev.filter(b => b._id !== batchId));
        alert(`Deleted batch + ${json.data.deletedSetups} trade setups.`);
      } else {
        alert(json.message || 'Failed to delete');
      }
    } catch { alert('Network error deleting batch'); }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleClearBatch = () => {
    setLocalBatchStocks([]);
    setLastImportInfo(null);
    setRankedResults([]);
    setRankingError(null);
    setSaveWarning(null);
    localStorage.removeItem('screenBatch');
    localStorage.removeItem('screenBatchImportInfo');
  };

  const handleLoadBatch = async (batchId: string) => {
    setLoadingBatchId(batchId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/screens/batch/${batchId}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const batch = json.data;

        // Restore localBatchStocks from symbols array
        const stocks = (batch.symbols || []).map((sym: string) => ({ symbol: sym, name: '' }));
        setLocalBatchStocks(stocks);
        localStorage.setItem('screenBatch', JSON.stringify(stocks));

        // Restore import info from runDate
        const runDate = new Date(batch.runDate);
        const dateStr = runDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const importInfo = { date: dateStr, count: stocks.length };
        setLastImportInfo(importInfo);
        localStorage.setItem('screenBatchImportInfo', JSON.stringify(importInfo));

        // Restore ranked results if present
        if (Array.isArray(batch.rankedResults) && batch.rankedResults.length > 0) {
          const ranked: RankedSymbol[] = batch.rankedResults.map((r: any) => ({
            symbol: r.symbol || '',
            lastPrice: r.lastPrice ?? null,
            prevClose: r.prevClose ?? null,
            percentChange: r.percentChange ?? null,
            score: r.score ?? 0,
            aiScore: r.aiScore ?? 0,
            aiBreakdown: r.aiBreakdown || null,
            error: r.error || undefined,
          }));
          setRankedResults(ranked);
        } else {
          setRankedResults([]);
        }

        setRankingError(null);
        setSaveWarning(null);
      }
    } catch (err) {
      console.error('Failed to load batch:', err);
    } finally {
      setLoadingBatchId(null);
    }
  };

  const handleRankBatch = async () => {
    if (localBatchStocks.length === 0) { alert('No symbols to rank in the current batch'); return; }
    setIsRanking(true);
    setRankingError(null);
    setRankedResults([]);
    try {
      const symbols = localBatchStocks.map(s => s.symbol);
      const response = await fetch(`${BACKEND_URL}/api/screens/rankBatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data?.ranked)) {
        const sorted = [...result.data.ranked].sort((a: RankedSymbol, b: RankedSymbol) => b.score - a.score);
        setRankedResults(sorted);

        // Best-effort: persist to MongoDB
        setSaveWarning(null);
        try {
          const saveRes = await fetch(`${BACKEND_URL}/api/screens/saveBatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              screenId: selectedScreen?.id || null,
              screenName: selectedScreen?.name || 'Unnamed Screen',
              symbols,
              rankedResults: sorted,
            })
          });
          if (!saveRes.ok) {
            console.error('saveBatch returned', saveRes.status);
            setSaveWarning('Ranked results displayed but failed to save to database.');
          }
        } catch (saveErr) {
          console.error('saveBatch error:', saveErr);
          setSaveWarning('Ranked results displayed but failed to save to database.');
        }
      } else {
        throw new Error(result.message || 'Invalid response format');
      }
    } catch (error: any) {
      setRankingError(error instanceof Error ? error.message : 'Failed to rank batch');
    } finally { setIsRanking(false); }
  };

  // What this does: Takes top N ranked stocks and asks AI for entry/SL/target trade setups
  const handleGenerateSetups = async () => {
    if (rankedResults.length === 0) return;
    setIsGeneratingSetups(true);
    setSetupError(null);
    setTradeSetups([]);
    setDuplicateInfo({ updated: [], skipped: [] });
    try {
      // Take top N stocks that have action potential (positive score preferred)
      const topSymbols = rankedResults
        .slice(0, setupCount)
        .map(r => r.symbol);

      const response = await fetch(`${BACKEND_URL}/api/trade-setup/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: topSymbols,
          screenBatchId: previousBatches[0]?._id || null,
          screenName: selectedScreen?.name || 'Unknown Screen',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API error: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success' && result.data) {
        const newSetups = Array.isArray(result.data.setups) ? result.data.setups : [];
        const updated = Array.isArray(result.data.updated) ? result.data.updated : [];
        const skipped = Array.isArray(result.data.skipped) ? result.data.skipped : [];
        setTradeSetups(newSetups);
        setDuplicateInfo({ updated, skipped });
      } else {
        throw new Error(result.message || 'Invalid response from AI');
      }
    } catch (error: any) {
      setSetupError(error instanceof Error ? error.message : 'Failed to generate trade setups');
    } finally {
      setIsGeneratingSetups(false);
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Screens</h1>
        <p className="text-gray-600">Define and manage your stock screening criteria</p>
      </div>

      {/* Screen Health Overview */}
      {recommendations && (
        <div className="glass-effect rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
              Screen Health
            </h3>
            <button onClick={fetchRecommendations} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ...(recommendations.recommended || []),
              ...(recommendations.active || []),
              ...(recommendations.underperforming || []),
              ...(recommendations.needsData || []),
            ].map((s: any) => (
              <div key={s.screenId} className={`p-3 rounded-lg border-2 ${
                s.score === null ? 'border-gray-200 bg-gray-50' :
                s.score >= 50 ? 'border-green-200 bg-green-50' :
                s.score >= 30 ? 'border-yellow-200 bg-yellow-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">{s.screenName}</span>
                  {s.score !== null ? (
                    <span className={`text-lg font-bold ${
                      s.score >= 50 ? 'text-green-600' : s.score >= 30 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{s.score}</span>
                  ) : (
                    <span className="text-sm text-gray-400">–</span>
                  )}
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' :
                  s.status === 'underperforming' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {s.status === 'new' ? 'Awaiting Results' : s.status}
                </span>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {s.status === 'new'
                    ? (s.totalBatches > 0
                      ? `${s.totalBatches} batch${s.totalBatches > 1 ? 'es' : ''} uploaded — waiting for trades to hit SL or Target`
                      : 'Upload CSV → Rank → Get AI Setup → trades must resolve first')
                    : s.reason}
                </p>
                {s.avgAIWinRate !== null && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Win: <span className="font-medium text-gray-700">{s.avgAIWinRate}%</span></span>
                    {s.avgReturn !== null && (
                      <span className="text-gray-500">Ret: <span className={`font-medium ${s.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.avgReturn >= 0 ? '+' : ''}{s.avgReturn}%</span></span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {recommendations.recommended?.length === 0 && recommendations.active?.length === 0 && recommendations.underperforming?.length === 0 && (
            <p className="text-sm text-gray-500 text-center mt-2">Run screens and let trades resolve to build performance scores</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="glass-effect rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Layers className="h-5 w-5 mr-2 text-blue-600" />
                Your Screens
              </h3>
              <button onClick={handleAddScreen} className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" title="Add new screen">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Loading screens...</div>
            ) : (
              <div className="space-y-3">
                {screens.map((screen) => (
                  <div key={screen.id} onClick={() => handleSelectScreen(screen.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedScreenId === screen.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm leading-snug">{screen.name}</h4>
                        <p className="text-xs text-gray-600">{screen.shortDescription}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={(e) => handleEditScreen(screen, e)} className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-colors" title="Edit screen">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => handleDeleteScreen(screen, e)} className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors" title="Delete screen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          {selectedScreen && (
            <div className="space-y-6">
              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-green-600" />
                  Screen Definition
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Screen Name</label>
                    <div className="text-xl font-semibold text-gray-900">{selectedScreen.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-gray-600">{selectedScreen.shortDescription}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Screener Query</label>
                    <textarea value={editableQueryText} onChange={(e) => setEditableQueryText(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={4} placeholder="Enter your screening criteria..." />
                    <p className="mt-1 text-xs text-gray-500">Define filters using conditions like: Market Cap &gt; 1000 AND PE Ratio &lt; 20</p>
                  </div>
                </div>
              </div>
              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-purple-600" />
                  Import Latest List
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={handleOpenUploadModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2">
                      <Upload className="h-4 w-4" />
                      <span>Upload CSV</span>
                    </button>
                    {screenerConnected ? (
                      <button onClick={handleFetchFromScreener} disabled={fetchLoading || !editableQueryText?.trim()}
                        title={!editableQueryText?.trim() ? 'Add a Screener Query to this screen first' : `Run query on screener.in (${screenerEmail})`}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2">
                        {fetchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span>{fetchLoading ? 'Fetching...' : 'Fetch from Screener.in'}</span>
                      </button>
                    ) : (
                      <button onClick={() => setShowLoginModal(true)}
                        className="px-4 py-2 border-2 border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center space-x-2">
                        <Download className="h-4 w-4" />
                        <span>Connect Screener.in</span>
                      </button>
                    )}
                    {localBatchStocks.length > 0 && (
                      <>
                        <button onClick={handleRankBatch} disabled={isRanking}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2">
                          <Sparkles className="h-4 w-4" />
                          <span>{isRanking ? 'Ranking...' : 'Rank this batch'}</span>
                        </button>
                        <button onClick={handleClearBatch} disabled={isRanking}
                          className="px-4 py-2 border-2 border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors flex items-center space-x-2">
                          <Trash2 className="h-4 w-4" />
                          <span>Clear batch</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {screenerConnected && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyLatestResults} onChange={(e) => setOnlyLatestResults(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                        Only companies with latest quarterly results
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input type="checkbox" checked={autoPipeline} onChange={(e) => setAutoPipeline(e.target.checked)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" />
                      Auto-rank &amp; generate trade setups on import
                    </label>
                  </div>
                  {pipelineStatus && (
                    <div className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
                      pipelineStatus.startsWith('✅') ? 'bg-green-50 text-green-700' :
                      pipelineStatus.startsWith('❌') ? 'bg-red-50 text-red-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {pipelineRunning && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                      {pipelineStatus}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Last import:</span> {lastImportInfo ? `${lastImportInfo.date} · ${lastImportInfo.count} companies` : 'none'}
                    </div>
                    {screenerConnected && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> screener.in ({screenerEmail})</span>
                        <button onClick={handleScreenerLogout} className="text-gray-400 hover:text-red-500" title="Disconnect screener.in">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {fetchError && (<div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center gap-2"><AlertTriangle className="h-4 w-4 flex-shrink-0" /> {fetchError}</div>)}
                  {rankingError && (<div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">Error: {rankingError}</div>)}
                  {saveWarning && (<div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">{saveWarning}</div>)}
                </div>
              </div>
              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><TrendingUp className="h-5 w-5 mr-2 text-blue-600" />Current Batch</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {localBatchStocks.length > 0 ? localBatchStocks.map((stock, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stock.symbol}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock.name || '—'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">No stocks in current batch. Upload a file to populate.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {rankedResults.length > 0 && (
              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Award className="h-5 w-5 mr-2 text-yellow-500" />Ranked Results <span className="ml-2 text-sm font-normal text-gray-500">({rankedResults.length} stocks — AI Fundamental Score /20)</span></h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% Chg</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">AI Score</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Financial Health">🏦</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Growth">📈</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Valuation">💰</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Technical">📊</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Momentum & Order Flow">📦</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Institutional Quality">🏛️</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Reasoning</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rankedResults.map((item, idx) => {
                        const hasAI = item.aiBreakdown != null;
                        const score = item.aiScore || 0;
                        const scoreColor = score >= 18 ? 'text-green-600' : score >= 12 ? 'text-blue-600' : score >= 6 ? 'text-yellow-600' : 'text-red-600';
                        const scoreBg = score >= 18 ? 'bg-green-100' : score >= 12 ? 'bg-blue-100' : score >= 6 ? 'bg-yellow-100' : 'bg-red-100';
                        return (
                        <tr key={item.symbol} className={idx < 5 ? 'bg-green-50' : ''}>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-mono-nums">{idx + 1}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">{item.symbol}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 font-mono-nums">{item.lastPrice != null ? `₹${item.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                          <td className={`px-3 py-3 whitespace-nowrap text-sm text-right font-medium font-mono-nums ${item.percentChange != null ? (item.percentChange > 0 ? 'text-green-600' : item.percentChange < 0 ? 'text-red-600' : 'text-gray-600') : 'text-gray-400'}`}>{item.percentChange != null ? `${item.percentChange > 0 ? '+' : ''}${item.percentChange.toFixed(2)}%` : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            {hasAI ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${scoreBg} ${scoreColor}`}>{item.aiScore}/24</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? item.aiBreakdown!.health : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? item.aiBreakdown!.growth : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? item.aiBreakdown!.valuation : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? item.aiBreakdown!.technical : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? (item.aiBreakdown!.orderFlow ?? '—') : '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-xs font-mono-nums">{hasAI ? (item.aiBreakdown!.institutional ?? '—') : '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={hasAI ? item.aiBreakdown!.reason : ''}>{hasAI ? item.aiBreakdown!.reason : (item.error || '')}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              {/* AI Trade Setups — appears after ranking */}
              {rankedResults.length > 0 && (
              <div className="glass-effect rounded-xl p-6 shadow-lg border-2 border-orange-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-orange-600" />
                    AI Trade Setups
                    <span className="ml-2 text-xs font-normal text-gray-400">Entry / SL / Target</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    <select
                      value={setupCount}
                      onChange={(e) => setSetupCount(Number(e.target.value))}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={isGeneratingSetups}
                    >
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                    <button
                      onClick={handleGenerateSetups}
                      disabled={isGeneratingSetups}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Zap className="h-4 w-4" />
                      {isGeneratingSetups ? 'Generating...' : 'Get AI Trade Setups'}
                    </button>
                  </div>
                </div>

                {isGeneratingSetups && (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">AI is analyzing top stocks and generating trade setups...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take 15-30 seconds</p>
                  </div>
                )}

                {setupError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
                    <ShieldAlert className="h-4 w-4 inline mr-1" />
                    {setupError}
                  </div>
                )}

                {tradeSetups.length > 0 && (
                  <div className="space-y-4">
                    {tradeSetups.map((setup, idx) => {
                      const isBuy = setup.action === 'BUY';
                      const isAvoid = setup.action === 'AVOID';
                      const riskPct = setup.entryPrice > 0 && setup.stopLoss > 0
                        ? (((setup.entryPrice - setup.stopLoss) / setup.entryPrice) * 100).toFixed(1)
                        : null;
                      const rewardPct = setup.entryPrice > 0 && setup.target > 0
                        ? (((setup.target - setup.entryPrice) / setup.entryPrice) * 100).toFixed(1)
                        : null;

                      return (
                        <div
                          key={setup._id || idx}
                          className={`rounded-lg border-2 p-5 ${
                            isAvoid
                              ? 'border-red-200 bg-red-50'
                              : isBuy
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-gray-900">{setup.symbol}</span>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                setup.action === 'BUY' ? 'bg-green-200 text-green-800' :
                                setup.action === 'SELL' ? 'bg-red-200 text-red-800' :
                                setup.action === 'AVOID' ? 'bg-red-300 text-red-900' :
                                'bg-yellow-200 text-yellow-800'
                              }`}>
                                {setup.action}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                setup.tradeType === 'SWING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {setup.tradeType}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Confidence:</span>
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    setup.confidence >= 70 ? 'bg-green-500' :
                                    setup.confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${setup.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{setup.confidence}%</span>
                            </div>
                          </div>

                          {/* Price grid */}
                          {!isAvoid && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                              <div className="bg-white rounded-lg p-3 text-center border">
                                <p className="text-xs text-gray-500 mb-1">Current Price</p>
                                <p className="text-sm font-bold text-gray-900">
                                  {setup.currentPrice ? `₹${setup.currentPrice.toLocaleString('en-IN')}` : '—'}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                                <p className="text-xs text-blue-600 mb-1 font-medium">Entry Price</p>
                                <p className="text-sm font-bold text-blue-700">
                                  ₹{setup.entryPrice.toLocaleString('en-IN')}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg p-3 text-center border border-red-200">
                                <p className="text-xs text-red-600 mb-1 font-medium flex items-center justify-center gap-1">
                                  <ArrowDownRight className="h-3 w-3" />Stop Loss
                                </p>
                                <p className="text-sm font-bold text-red-700">
                                  ₹{setup.stopLoss.toLocaleString('en-IN')}
                                </p>
                                {riskPct && <p className="text-xs text-red-500">-{riskPct}%</p>}
                              </div>
                              <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                                <p className="text-xs text-green-600 mb-1 font-medium flex items-center justify-center gap-1">
                                  <ArrowUpRight className="h-3 w-3" />Target
                                </p>
                                <p className="text-sm font-bold text-green-700">
                                  ₹{setup.target.toLocaleString('en-IN')}
                                </p>
                                {rewardPct && <p className="text-xs text-green-500">+{rewardPct}%</p>}
                              </div>
                            </div>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap gap-3 mb-3 text-xs">
                            <span className="bg-white px-2 py-1 rounded border text-gray-700">
                              <strong>R:R</strong> {setup.riskRewardRatio}
                            </span>
                            <span className="bg-white px-2 py-1 rounded border text-gray-700">
                              <strong>Duration:</strong> {setup.holdingDuration}
                            </span>
                          </div>

                          {/* Reasoning */}
                          <p className="text-sm text-gray-700 mb-2">{setup.reasoning}</p>

                          {/* Risk factors */}
                          {setup.riskFactors.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {setup.riskFactors.map((risk, rIdx) => (
                                <span key={rIdx} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  ⚠ {risk}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isGeneratingSetups && (tradeSetups.length > 0 || duplicateInfo.updated.length > 0 || duplicateInfo.skipped.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {tradeSetups.length > 0 && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
                        <p className="text-sm text-blue-700">
                          {tradeSetups.length} new setup{tradeSetups.length > 1 ? 's' : ''} saved as <strong>paper trades</strong> — monitored every 2 min during market hours.
                        </p>
                        <button
                          onClick={() => {
                            const navEvent = new CustomEvent('navigateToTab', { detail: 'paper' });
                            window.dispatchEvent(navEvent);
                          }}
                          className="ml-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg whitespace-nowrap transition-colors"
                        >
                          View in Paper Trading →
                        </button>
                      </div>
                    )}
                    {duplicateInfo.updated.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
                        <p className="text-sm font-semibold text-amber-800 mb-1">SL/Target Updated for Active Trades:</p>
                        {duplicateInfo.updated.map((u: any, i: number) => (
                          <div key={i} className="text-xs text-amber-700 ml-2 mb-1">
                            <strong>{u.symbol}</strong>: {(u._changes || []).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                    {duplicateInfo.skipped.length > 0 && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-600 mb-1">Skipped (already active):</p>
                        {duplicateInfo.skipped.map((s: any, i: number) => (
                          <div key={i} className="text-xs text-gray-500 ml-2">
                            <strong>{s.symbol}</strong> — {s.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isGeneratingSetups && tradeSetups.length === 0 && !setupError && (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    Click &quot;Get AI Trade Setups&quot; to generate entry/SL/target for top ranked stocks.
                  </p>
                )}
              </div>
              )}

              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-indigo-600" />
                  Previous Batches
                  {previousBatches.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">({previousBatches.length} batches)</span>
                  )}
                </h3>
                {loadingBatches ? (
                  <div className="text-center py-6 text-gray-500 text-sm">Loading batches...</div>
                ) : previousBatches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Screen</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stocks</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previousBatches.map((batch) => (
                          <tr key={batch._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(batch.runDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{batch.screenName || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">{batch.batchSize}</td>
                            <td className="px-4 py-3 whitespace-nowrap flex gap-2">
                              <button
                                onClick={() => handleLoadBatch(batch._id)}
                                disabled={loadingBatchId === batch._id}
                                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-1"
                              >
                                <RotateCcw className={`h-3 w-3 ${loadingBatchId === batch._id ? 'animate-spin' : ''}`} />
                                {loadingBatchId === batch._id ? 'Loading...' : 'Load'}
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(batch._id, batch.screenName || 'Unknown')}
                                className="px-3 py-1.5 text-xs border border-red-300 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">No previous batches saved for this screen.</p>
                )}
              </div>

              {/* Screen Performance Tracking */}
              <div className="glass-effect rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-emerald-600" />
                  Screen Performance
                  <span className="ml-2 text-xs font-normal text-gray-400">(batches older than 5 days)</span>
                </h3>
                {loadingPerformance ? (
                  <div className="text-center py-6 text-gray-500 text-sm">Calculating performance...</div>
                ) : performanceData && performanceData.screens && performanceData.screens.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {performanceData.screens.map((screen) => (
                        <div key={screen.screenName}
                          className={`p-4 rounded-lg border-2 ${
                            selectedScreen?.name === screen.screenName ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 truncate" title={screen.screenName}>{screen.screenName}</h4>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500">Hit Rate</p>
                              <p className={`text-lg font-bold ${screen.overallHitRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                {screen.overallHitRate}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Avg Return</p>
                              <p className={`text-lg font-bold ${screen.overallAvgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {screen.overallAvgReturn >= 0 ? '+' : ''}{screen.overallAvgReturn}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Batches</p>
                              <p className="text-lg font-bold text-gray-700">{screen.totalBatches}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      Hit Rate = % of stocks whose price went up since ranking day. Avg Return = mean % gain/loss across all ranked stocks.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No performance data yet. Run screens daily for 5+ days to start tracking hit rates.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showScreenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{modalMode === 'edit' ? 'Edit Screen' : 'Add New Screen'}</h2>
                <button onClick={() => setShowScreenModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Screen Name *</label>
                  <input type="text" value={modalData.name} onChange={(e) => setModalData({ ...modalData, name: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. High Growth Stocks" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={modalData.shortDescription} onChange={(e) => setModalData({ ...modalData, shortDescription: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Brief description of this screen" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Screener Query</label>
                  <textarea value={modalData.queryText} onChange={(e) => setModalData({ ...modalData, queryText: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} placeholder="e.g. YOY profit growth > 25% AND PE Ratio < 20" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowScreenModal(false)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={handleSaveScreen} disabled={savingScreen} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors">{savingScreen ? 'Saving...' : 'Save Screen'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Upload className="h-6 w-6 text-blue-600" />Upload Stock List</h2>
                <button onClick={handleCancelUpload} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
              </div>
              <div className="mb-6 space-y-4">
                <p className="text-sm text-gray-600">Upload an Excel (.xlsx) or CSV file exported from Screener.in or similar. The file should have a Symbol, Ticker, or Name column.</p>
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors border border-gray-300">
                    <Upload className="h-4 w-4" />
                    <span>Choose file</span>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleCsvFileChange} className="hidden" />
                  </label>
                </div>
                {csvFileName && (
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium">Selected:</span> {csvFileName}
                  </div>
                )}
                {csvParsedStocks.length > 0 && (
                  <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg font-medium">
                    Found {csvParsedStocks.length} stocks in the file
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={handleCancelUpload} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSaveBatch} disabled={csvParsedStocks.length === 0} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"><Upload className="h-4 w-4" />Save to Batch</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Screener.in Login Modal (one-time setup) ──────────────────────── */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Download className="h-5 w-5 text-purple-600" />
                  Connect Screener.in
                </h2>
                <button onClick={() => { setShowLoginModal(false); setFetchError(null); }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-gray-600">Enter your screener.in email + password. Saved locally on your machine — only sent to screener.in for login.</p>
              {fetchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {fetchError}
                </div>
              )}
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Email" />
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScreenerLogin()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Password" />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowLoginModal(false); setFetchError(null); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
                <button onClick={handleScreenerLogin} disabled={fetchLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm flex items-center gap-2">
                  {fetchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {fetchLoading ? 'Connecting...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Screener.in Fetched Results Modal ─────────────────────────────── */}
      {showFetchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Fetched {fetchedCompanies.length} companies
                  </h2>
                </div>
                <button onClick={handleCloseFetchModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-gray-600">From screen: <strong>{fetchedScreenName}</strong></p>

              {alreadyImportedToday && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Already imported today. Importing again creates a new batch.
                </div>
              )}

              <div className="max-h-[350px] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fetchedCompanies.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-1.5 text-gray-900">{c.name}</td>
                        <td className="px-3 py-1.5 text-gray-600 font-mono text-xs">{c.symbol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={handleCloseFetchModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
                <button onClick={handleImportFetched}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Import {fetchedCompanies.length} companies
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreensTab;

