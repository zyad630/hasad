/**
 * SmartSearch Component — Request 1
 * Instant search dropdown with keyboard navigation (arrow keys + Enter)
 * Debounced 200ms, Arabic diacritic-insensitive search
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SmartSearchProps {
  placeholder?: string;
  onSearch: (query: string) => Promise<any[]> | any[];
  onSelect: (item: any) => void;
  renderItem?: (item: any) => React.ReactNode;
  getLabel?: (item: any) => string;
  value?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onEnterEmpty?: () => void;
  inputRef?: any;
  style?: React.CSSProperties;
  id?: string;
}

/** Strip Arabic diacritics (harakat) for insensitive matching */
function stripDiacritics(str: string): string {
  if (!str) return '';
  return str.replace(/[\u064B-\u065F\u0670]/g, '');
}

function mapEnToArabicKeyboard(str: string): string {
  const map: Record<string, string> = {
    q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح',
    '[': 'ج', ']': 'د',
    a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م',
    ';': 'ك', "'": 'ط',
    z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة',
    ',': 'و', '.': 'ز', '/': 'ظ',
    '`': 'ذ',
  };
  return String(str)
    .split('')
    .map((ch) => map[ch.toLowerCase()] ?? ch)
    .join('');
}

function normalizeForSearch(str: string): string {
  let s = stripDiacritics(String(str || '').trim().toLowerCase());
  // Normalize Alefs
  s = s.replace(/[أإآٱ]/g, 'ا');
  // Normalize Yaa
  s = s.replace(/ى/g, 'ي');
  // Normalize Taa Marbuta
  s = s.replace(/ة/g, 'ه');
  return s;
}

function getSearchNeedles(q: string): string[] {
  const a = normalizeForSearch(q);
  const b = normalizeForSearch(mapEnToArabicKeyboard(q));
  return a === b ? [a] : [a, b];
}

export function SmartSearch({
  placeholder = 'ابحث...',
  onSearch,
  onSelect,
  renderItem,
  getLabel = (item) => item.name || item.label || String(item),
  value = '',
  disabled = false,
  autoFocus = false,
  onEnterEmpty,
  inputRef: externalRef,
  style,
  id,
}: SmartSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);

  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef || internalRef;
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // Update query when value prop changes
  useEffect(() => { setQuery(value); }, [value]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return [];
    }
    setLoading(true);
    try {
      const raw = await onSearch(q);
      const needles = getSearchNeedles(q);
      const filtered = raw.filter((item: any) => {
        const label = normalizeForSearch(getLabel(item));
        return needles.some((n) => label.includes(n));
      });
      filtered.sort((a: any, b: any) => {
        const la = normalizeForSearch(getLabel(a));
        const lb = normalizeForSearch(getLabel(b));
        
        // Priority 1: Exact match with any needle
        const aExact = needles.some(n => la === n);
        const bExact = needles.some(n => lb === n);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Priority 2: Starts with any needle
        const aStarts = needles.some(n => la.startsWith(n));
        const bStarts = needles.some(n => lb.startsWith(n));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Priority 3: Alphabetical
        return la.localeCompare(lb, 'ar');
      });
      const sliced = filtered.slice(0, 20);
      setResults(sliced);
      setOpen(filtered.length > 0);
      setActiveIdx(-1);
      return sliced;
    } finally {
      setLoading(false);
    }
  }, [onSearch, getLabel]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 200);
  };

  const handleSelect = (item: any) => {
    setQuery(getLabel(item));
    setOpen(false);
    setResults([]);
    onSelect(item);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!open) {
      if (e.key === 'Enter' && !query.trim() && onEnterEmpty) {
        onEnterEmpty();
        return;
      }
      if (e.key === 'Enter' && query.trim()) {
        const now = await doSearch(query);
        if (now.length > 0) {
          handleSelect(now[0]);
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && results[activeIdx]) {
        handleSelect(results[activeIdx]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative', direction: 'rtl', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          style={{
            width: '100%',
            height: '44px',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '0 12px 0 36px',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 600,
            outline: 'none',
            background: 'white',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            direction: 'rtl',
          }}
          onFocusCapture={e => { (e.target as HTMLInputElement).style.borderColor = '#059669'; }}
          onBlurCapture={e => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
        />
        <span style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          color: loading ? '#059669' : '#9ca3af', fontSize: '14px', pointerEvents: 'none',
        }}>
          {loading ? '⟳' : '⌕'}
        </span>
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 9999,
            background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)', maxHeight: '280px',
            overflowY: 'auto', marginTop: '4px',
          }}
        >
          {results.map((item, idx) => (
            <div
              key={idx}
              onMouseDown={() => handleSelect(item)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontWeight: idx === activeIdx ? 800 : 600,
                background: idx === activeIdx ? '#f0fdf4' : 'transparent',
                borderBottom: idx < results.length - 1 ? '1px solid #f3f4f6' : 'none',
                fontSize: '14px',
                color: '#1f2937',
                borderRadius: idx === 0 ? '10px 10px 0 0' : idx === results.length - 1 ? '0 0 10px 10px' : '0',
                transition: 'background 0.1s',
              }}
            >
              {renderItem ? renderItem(item) : (
                <span>{getLabel(item)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SmartSearch;
