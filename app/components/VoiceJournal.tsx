'use client';

/**
 * VoiceJournal — Phase 6 deliverable #4.
 *
 * Records short audio clips (≤ 60s) via MediaRecorder, POSTs to
 * /api/journal/voice as multipart. If a tradeSetupId is passed, the
 * transcription is attached to that setup.
 *
 * SECURITY: raw audio is sent to the backend, which forwards it to
 * Whisper for transcription. The raw audio is NOT persisted. Only the
 * transcription is stored in MongoDB.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';
const MAX_DURATION_SEC = 60;

interface VoiceJournalProps {
  tradeSetupId?: string;
  compact?: boolean;
  onTranscribed?: (note: { content: string; _id: string }) => void;
}

type State = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

export default function VoiceJournal({ tradeSetupId, compact = false, onTranscribed }: VoiceJournalProps) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string>('');
  const [elapsed, setElapsed] = useState(0);
  const [transcription, setTranscription] = useState<string>('');
  const [provider, setProvider] = useState<string>('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => cleanup(), []);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    try { recorderRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
  };

  const start = async () => {
    setError('');
    setTranscription('');
    setProvider('');
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported on this device.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleStop;

      recorder.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === 'recording') stop();
      }, MAX_DURATION_SEC * 1000);
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Failed to start recording');
      cleanup();
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.stop(); } catch {}
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const handleStop = async () => {
    const duration = elapsed;
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });
    if (blob.size === 0) {
      setState('error');
      setError('No audio recorded.');
      return;
    }
    setState('uploading');

    try {
      const form = new FormData();
      form.append('audio', blob, 'voice-note.webm');
      if (tradeSetupId) form.append('tradeSetupId', tradeSetupId);
      form.append('durationSec', String(duration));

      const res = await fetch(`${BACKEND_URL}/api/journal/voice`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message || 'Upload failed');
      setTranscription(json.data.note.content || '');
      setProvider(json.data.transcription.provider || '');
      setState('done');
      onTranscribed?.({ content: json.data.note.content, _id: json.data.note._id });
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Upload failed');
    } finally {
      chunksRef.current = [];
    }
  };

  const reset = () => {
    cleanup();
    setState('idle');
    setError('');
    setTranscription('');
    setElapsed(0);
  };

  const isBusy = state === 'recording' || state === 'uploading';

  return (
    <div className={compact ? 'space-y-2' : 'glass-effect rounded-xl p-4 shadow-lg space-y-3'}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-rose-600" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Voice Journal</h3>
          <span className="text-[10px] text-gray-400 ml-auto">Max 60s · raw audio not stored</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {state !== 'recording' ? (
          <button
            onClick={start}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 min-h-[44px] text-sm"
            aria-label="Start recording"
          >
            <Mic className="h-4 w-4" /> Record
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 min-h-[44px] text-sm"
            aria-label="Stop recording"
          >
            <Square className="h-4 w-4" /> Stop ({elapsed}s)
          </button>
        )}

        {state === 'recording' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Recording {elapsed}/{MAX_DURATION_SEC}s
          </span>
        )}

        {state === 'uploading' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…
          </span>
        )}

        {state === 'done' && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-auto min-h-[44px] sm:min-h-0 px-2"
            aria-label="Record another"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {state === 'error' && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {state === 'done' && transcription && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-800 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            {provider && provider !== 'stub' && <span className="text-[10px] text-green-700">· via {provider}</span>}
            {provider === 'stub' && <span className="text-[10px] text-amber-700">· stub (set OPENAI_API_KEY)</span>}
          </div>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{transcription}</p>
        </div>
      )}
    </div>
  );
}
