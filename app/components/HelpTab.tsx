'use client';

/**
 * HelpTab — in-app instructions for every tab + feature.
 *
 * Per CLAUDE.md §Work Style rule #4: every new feature must be added to
 * `helpContent.ts` in the same commit that ships it.
 *
 * UI: left sidebar of sections, right pane with lessons. URL anchor support
 * via window.location.hash (e.g. #options jumps to Options section).
 */

import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search, ChevronRight, AlertTriangle, Lightbulb, ListChecks } from 'lucide-react';
import { HELP_CONTENT, HelpSection } from './helpContent';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function HelpTab() {
  const [activeId, setActiveId] = useState<string>(HELP_CONTENT[0].id);
  const [query, setQuery] = useState('');

  // Handle #hash anchors (clicking a help "?" from another tab sets hash)
  useEffect(() => {
    const h = (typeof window !== 'undefined' && window.location.hash) || '';
    if (h) {
      const id = h.replace('#', '');
      if (HELP_CONTENT.find(s => s.id === id)) setActiveId(id);
    }
  }, []);

  // Filtered content based on search
  const filtered = useMemo(() => {
    if (!query.trim()) return HELP_CONTENT;
    const q = query.toLowerCase();
    return HELP_CONTENT
      .map(section => {
        const matchingLessons = section.lessons.filter(l =>
          l.title.toLowerCase().includes(q) ||
          l.summary.toLowerCase().includes(q) ||
          (l.steps || []).some(s => s.toLowerCase().includes(q)) ||
          (l.tips || []).some(t => t.toLowerCase().includes(q)) ||
          (l.warnings || []).some(w => w.toLowerCase().includes(q))
        );
        if (section.title.toLowerCase().includes(q) || matchingLessons.length > 0) {
          return { ...section, lessons: matchingLessons.length > 0 ? matchingLessons : section.lessons };
        }
        return null;
      })
      .filter((s): s is HelpSection => s !== null);
  }, [query]);

  const activeSection = filtered.find(s => s.id === activeId) || filtered[0];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Instructions & Help</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          How to use every tab and feature. Every shipped feature is documented here per the project maintenance rule.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search instructions…"
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="md:sticky md:top-20 md:h-[calc(100vh-6rem)] md:overflow-y-auto">
          <nav className="space-y-1">
            {filtered.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveId(section.id);
                  if (typeof window !== 'undefined') window.location.hash = section.id;
                }}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeId === section.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{section.title}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          {activeSection ? (
            <>
              <div className="mb-4">
                <h2 id={activeSection.id} className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {activeSection.title}
                </h2>
                {activeSection.intro && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{activeSection.intro}</p>
                )}
              </div>

              <div className="space-y-4">
                {activeSection.lessons.map(lesson => (
                  <div
                    key={slugify(lesson.title)}
                    id={slugify(lesson.title)}
                    className="border border-gray-100 dark:border-gray-700 rounded-lg p-4"
                  >
                    <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">
                      {lesson.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {lesson.summary}
                    </p>

                    {lesson.steps && lesson.steps.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                          <ListChecks className="w-3.5 h-3.5" />
                          How to use
                        </div>
                        <ol className="list-decimal list-inside text-[13px] text-gray-700 dark:text-gray-300 space-y-1 pl-1">
                          {lesson.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {lesson.tips && lesson.tips.length > 0 && (
                      <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-md p-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">
                          <Lightbulb className="w-3.5 h-3.5" />
                          Tips
                        </div>
                        <ul className="list-disc list-inside text-[13px] text-gray-700 dark:text-gray-300 space-y-0.5 pl-1">
                          {lesson.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lesson.warnings && lesson.warnings.length > 0 && (
                      <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Warning
                        </div>
                        <ul className="list-disc list-inside text-[13px] text-gray-700 dark:text-gray-300 space-y-0.5 pl-1">
                          {lesson.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No results for &quot;{query}&quot;. Try a different search term.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
