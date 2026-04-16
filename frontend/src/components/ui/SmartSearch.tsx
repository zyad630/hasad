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
  const [hasTyped, setHasTyped] = useState(false);

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
    setHasTyped(true);
    try {
      const raw = await onSearch(q);
      const needles = getSearchNeedles(q);
      
      // If we got results back from an API search, they might already be filtered.
      // We should check if they are an array first.
      const rawList = Array.isArray(raw) ? raw : (raw?.results || []);
      
      // We still filter to ensure relevance if onSearch returned a broad set or all records.
      const filtered = rawList.filter((item: any) => {
        const lbl = getLabel(item);
        if (!lbl) return false;
        const normalizedLabel = normalizeForSearch(lbl);
        return needles.some((n) => normalizedLabel.includes(n) || String(lbl).toLowerCase().includes(q.toLowerCase()));
      });

      filtered.sort((a: any, b: any) => {
        const la = normalizeForSearch(getLabel(a));
        const lb = normalizeForSearch(getLabel(b));
        
        const aExact = needles.some(n => la === n);
        const bExact = needles.some(n => lb === n);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = needles.some(n => la.startsWith(n));
        const bStarts = needles.some(n => lb.startsWith(n));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return la.localeCompare(lb, 'ar');
      });

      const sliced = filtered.slice(0, 50);
      setResults(sliced);
      setOpen(true); 
      setActiveIdx(-1);
      return sliced;
    } catch (err) {
      console.error("SmartSearch Error:", err);
      return [];
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
        if (now.length === 1) {
          handleSelect(now[0]);
        } else if (now.length > 1) {
          setOpen(true);
          setActiveIdx(0);
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && results[activeIdx]) {
        handleSelect(results[activeIdx]);
      } else if (results.length === 1) {
        handleSelect(results[0]);
      } else if (results.length > 1) {
        setActiveIdx(0);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      (e.nativeEvent as Event).stopImmediatePropagation();
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

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
    <div style={{ position: 'relative', direction: 'rtl', width: '100%', ...style }}>
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
            height: '48px',
            border: '2px solid #f1f5f9',
            borderRadius: '16px',
            padding: '0 16px 0 44px',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 800,
            outline: 'none',
            background: '#f8fafc',
            boxSizing: 'border-box',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            direction: 'rtl',
            boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
          }}
          onFocusCapture={e => { 
            (e.target as HTMLInputElement).style.borderColor = '#10b981'; 
            (e.target as HTMLInputElement).style.background = '#ffffff';
            (e.target as HTMLInputElement).style.boxShadow = '0 10px 15px -3px rgba(16, 185, 129, 0.1)';
          }}
          onBlurCapture={e => { 
            (e.target as HTMLInputElement).style.borderColor = '#f1f5f9'; 
            (e.target as HTMLInputElement).style.background = '#f8fafc';
            (e.target as HTMLInputElement).style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
          }}
        />
        <span style={{
          position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
          color: loading ? '#10b981' : '#94a3b8', fontSize: '20px', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
        }}>
          {loading ? (
             <span className="animate-spin" style={{ display: 'inline-block', width: '20px', height: '20px', border: '3px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%' }}></span>
          ) : (
             <span className="material-symbols-outlined">search</span>
          )}
        </span>
      </div>

      {open && (query.trim()) && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, left: 0, zIndex: 10000,
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '18px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
            maxHeight: '320px',
            overflowY: 'auto', padding: '6px',
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .smart-search-item:hover { background: #f0fdf4 !important; }
          `}</style>
          
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div
                key={idx}
                className="smart-search-item"
                onMouseDown={() => handleSelect(item)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontWeight: idx === activeIdx ? 1000 : 700,
                  background: idx === activeIdx ? '#f0fdf4' : 'transparent',
                  color: idx === activeIdx ? '#065f46' : '#1e293b',
                  fontSize: '14px',
                  borderRadius: '12px',
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '2px',
                }}
              >
                {renderItem ? renderItem(item) : (
                  <span style={{ flex: 1 }}>{getLabel(item)}</span>
                )}
                {idx === activeIdx && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_return</span>}
              </div>
            ))
          ) : !loading && hasTyped ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.5 }}>sentiment_dissatisfied</span>
              <div style={{ fontWeight: 900, fontSize: '15px', color: '#64748b' }}>عفواً، لا توجد نتائج</div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>تأكد من كتابة الاسم أو الرقم بشكل صحيح</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default SmartSearch;
