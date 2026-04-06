'use client';

import { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, X, Pin, PinOff, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

const COLORS = [
  { name: 'Yellow', value: '#fef9c3' },
  { name: 'Green', value: '#dcfce7' },
  { name: 'Blue', value: '#dbeafe' },
  { name: 'Pink', value: '#fce7f3' },
  { name: 'Orange', value: '#ffedd5' },
  { name: 'Purple', value: '#f3e8ff' },
];

interface Note {
  _id: string;
  title: string;
  content: string;
  images: string[];
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const StickyNotes = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) fetchNotes();
  }, [isOpen]);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notes`);
      const json = await res.json();
      if (json.status === 'success') setNotes(json.data);
    } catch {}
  };

  const createNote = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', content: '', color: '#fef9c3' }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setNotes(prev => [json.data, ...prev]);
        setExpandedNote(json.data._id);
      }
    } catch {}
  };

  const updateNote = (id: string, field: string, value: any) => {
    setNotes(prev => prev.map(n => n._id === id ? { ...n, [field]: value } : n));
    // Debounced save
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    setSaving(id);
    saveTimers.current[id] = setTimeout(async () => {
      const note = notes.find(n => n._id === id);
      if (!note) return;
      const updated = { ...note, [field]: value };
      try {
        await fetch(`${BACKEND_URL}/api/notes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: updated.title, content: updated.content, images: updated.images, color: updated.color, pinned: updated.pinned }),
        });
      } catch {}
      setSaving(null);
    }, 600);
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/notes/${id}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n._id !== id));
      if (expandedNote === id) setExpandedNote(null);
    } catch {}
  };

  const togglePin = (id: string) => {
    const note = notes.find(n => n._id === id);
    if (!note) return;
    updateNote(id, 'pinned', !note.pinned);
  };

  const handleImageUpload = (noteId: string) => {
    setUploadingFor(noteId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const note = notes.find(n => n._id === uploadingFor);
      if (note) {
        const newImages = [...note.images, base64];
        updateNote(uploadingFor, 'images', newImages);
      }
      setUploadingFor(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (noteId: string, imgIdx: number) => {
    const note = notes.find(n => n._id === noteId);
    if (!note) return;
    const newImages = note.images.filter((_, i) => i !== imgIdx);
    updateNote(noteId, 'images', newImages);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-20 right-6 z-50">
      {/* Notes Panel */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-[380px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-gray-900 text-sm">Quick Notes</span>
              <span className="text-xs text-gray-500">({notes.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={createNote} className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors" title="New note">
                <Plus className="h-4 w-4 text-amber-700" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <StickyNote className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notes yet</p>
                <button onClick={createNote} className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium">
                  + Create your first note
                </button>
              </div>
            ) : (
              notes.map(note => {
                const isExpanded = expandedNote === note._id;
                return (
                  <div key={note._id} className="rounded-xl border border-gray-200 overflow-hidden transition-all" style={{ backgroundColor: note.color }}>
                    {/* Note header */}
                    <div className="flex items-center gap-1 px-3 py-2 cursor-pointer" onClick={() => setExpandedNote(isExpanded ? null : note._id)}>
                      <button className="p-0.5" onClick={(e) => { e.stopPropagation(); togglePin(note._id); }}>
                        {note.pinned ? <Pin className="h-3 w-3 text-amber-600" /> : <PinOff className="h-3 w-3 text-gray-400" />}
                      </button>
                      <input
                        value={note.title}
                        onChange={(e) => updateNote(note._id, 'title', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Note title..."
                        className="flex-1 bg-transparent text-sm font-medium text-gray-800 border-none outline-none placeholder-gray-400 min-w-0"
                      />
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(note.updatedAt)}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <textarea
                          value={note.content}
                          onChange={(e) => updateNote(note._id, 'content', e.target.value)}
                          placeholder="Write your note..."
                          className="w-full bg-white/60 rounded-lg p-2 text-xs text-gray-700 border border-gray-200/50 outline-none resize-none min-h-[80px] focus:ring-1 focus:ring-amber-300"
                          rows={4}
                        />

                        {/* Images */}
                        {note.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {note.images.map((img, i) => (
                              <div key={i} className="relative group">
                                <img src={img} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                                <button
                                  onClick={() => removeImage(note._id, i)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions bar */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1">
                            {/* Color picker */}
                            {COLORS.map(c => (
                              <button
                                key={c.value}
                                onClick={() => updateNote(note._id, 'color', c.value)}
                                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 ${note.color === c.value ? 'border-gray-600 scale-110' : 'border-gray-300'}`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            {saving === note._id && <span className="text-[10px] text-gray-400">Saving...</span>}
                            <button onClick={() => handleImageUpload(note._id)} className="p-1 hover:bg-white/50 rounded transition-colors" title="Add image">
                              <ImageIcon className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                            <button onClick={() => deleteNote(note._id)} className="p-1 hover:bg-red-100 rounded transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isOpen ? 'bg-amber-500 text-white' : 'bg-amber-400 text-white hover:bg-amber-500'
        }`}
        title="Quick Notes"
      >
        <StickyNote className="h-5 w-5" />
        {notes.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {notes.length}
          </span>
        )}
      </button>
    </div>
  );
};

export default StickyNotes;
