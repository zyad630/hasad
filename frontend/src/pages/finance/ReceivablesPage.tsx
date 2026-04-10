import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const dzApi = api.injectEndpoints({
  endpoints: (b) => ({
    getReceivables: b.query({
      query: (params: any) => ({ url: 'reports/receivables/', params }),
      providesTags: ['Receivables'],
    }),
  }),
  overrideExisting: false,
});
export const { useGetReceivablesQuery } = dzApi;

const PARTY_TABS = [
  { id: 'all',       label: 'الجميع',       icon: 'fa-users',         color: '#6366f1' },
  { id: 'farmers',   label: 'المزارعون',   icon: 'fa-tractor',       color: '#059669' },
  { id: 'traders',   label: 'التجار/الزبائن', icon: 'fa-store',    color: '#0ea5e9' },
  { id: 'employees', label: 'الموظفون',    icon: 'fa-id-badge',      color: '#f59e0b' },
  { id: 'partners',  label: 'الشركاء',     icon: 'fa-handshake',     color: '#8b5cf6' },
];

export default function ReceivablesPage() {
  const [party, setParty] = useState('all');
  const [currency, setCurrency] = useState('');

  const { data, isLoading, isError, error, refetch } = useGetReceivablesQuery({ party, currency: currency || undefined });

  if (isLoading) return <VegetableLoader text="جاري تحميل الذمم..." fullScreen />;

  if (isError) {
    const errAny: any = error as any;
    const message = errAny?.data?.detail || errAny?.data?.error || errAny?.error || 'فشل تحميل الذمم من الخادم.';
    return (
      <div style={{ direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#18181b' }}>
              <i className="fa-solid fa-scale-balanced" style={{ color: '#059669', marginLeft: '10px' }} />
              الذمم المالية (المدينون والدائنون)
            </h1>
            <p style={{ margin: '4px 0 0', color: '#71717a', fontSize: '13px' }}>
              المستحقات على الزبائن والمزارعين والموظفين والشركاء
            </p>
          </div>
          <button onClick={() => refetch()} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            <i className="fa-solid fa-rotate" style={{ marginLeft: '6px' }} /> إعادة المحاولة
          </button>
        </div>

        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', padding: '14px 16px', borderRadius: '14px', fontWeight: 800 }}>
          {message}
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const farmers   = data?.farmers   || [];
  const traders   = data?.traders   || [];
  const employees = data?.employees || [];
  const partners  = data?.partners  || [];

  const getPartyList = () => {
    if (party === 'farmers')   return farmers;
    if (party === 'traders')   return traders;
    if (party === 'employees') return employees;
    if (party === 'partners')  return partners;
    return [];
  };

  const allEntries = party === 'all'
    ? [...farmers, ...traders, ...employees, ...partners]
    : getPartyList();

  const currentTab = PARTY_TABS.find(t => t.id === party)!;

  return (
    <div style={{ direction: 'rtl' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#18181b' }}>
            <i className="fa-solid fa-scale-balanced" style={{ color: '#059669', marginLeft: '10px' }} />
            الذمم المالية (المدينون والدائنون)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#71717a', fontSize: '13px' }}>
            المستحقات على الزبائن والمزارعين والموظفين والشركاء
          </p>
        </div>
        <button onClick={() => refetch()} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
          <i className="fa-solid fa-rotate" style={{ marginLeft: '6px' }} /> تحديث
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          label="إجمالي المستحقات (على الزبائن)"
          value={`${summary.total_receivable_base?.toLocaleString() ?? '0'} ₪`}
          color="#0ea5e9" icon="fa-arrow-trend-up"
        />
        <StatCard
          label="إجمالي المديونيات (للمزارعين)"
          value={`${summary.total_payable_base?.toLocaleString() ?? '0'} ₪`}
          color="#059669" icon="fa-arrow-trend-down"
        />
        <StatCard label="مزارعون" value={summary.farmers_count ?? 0} color="#059669" icon="fa-tractor" />
        <StatCard label="تجار/زبائن" value={summary.traders_count ?? 0} color="#0ea5e9" icon="fa-store" />
        <StatCard label="موظفون" value={summary.employees_count ?? 0} color="#f59e0b" icon="fa-id-badge" />
        <StatCard label="شركاء" value={summary.partners_count ?? 0} color="#8b5cf6" icon="fa-handshake" />
      </div>

      {/* ── Party Filter Tabs ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {PARTY_TABS.map(t => (
          <button key={t.id} onClick={() => setParty(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '20px', fontWeight: 700, fontSize: '13px',
            background: party === t.id ? t.color : '#f4f4f5',
            color: party === t.id ? 'white' : '#52525b',
            border: `2px solid ${party === t.id ? t.color : 'transparent'}`,
            cursor: 'pointer',
          }}>
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
            <span style={{ background: party === t.id ? 'rgba(255,255,255,0.25)' : '#e4e4e7', padding: '1px 8px', borderRadius: '12px', fontSize: '11px' }}>
              {t.id === 'all' ? allEntries.length : (t.id === 'farmers' ? farmers : t.id === 'traders' ? traders : t.id === 'employees' ? employees : partners).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grouped View (only for 'all') ── */}
      {party === 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[
            { key: 'farmers',   list: farmers,   tab: PARTY_TABS[1] },
            { key: 'traders',   list: traders,   tab: PARTY_TABS[2] },
            { key: 'employees', list: employees, tab: PARTY_TABS[3] },
            { key: 'partners',  list: partners,  tab: PARTY_TABS[4] },
          ].filter(g => g.list.length > 0).map(group => (
            <div key={group.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '4px', height: '20px', background: group.tab.color, borderRadius: '2px' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: group.tab.color }}>
                  <i className={`fa-solid ${group.tab.icon}`} style={{ marginLeft: '8px' }} />
                  {group.tab.label}
                </h3>
                <span style={{ color: '#a1a1aa', fontSize: '13px' }}>({group.list.length} جهة)</span>
              </div>
              <PartyTable entries={group.list} color={group.tab.color} />
            </div>
          ))}
        </div>
      ) : (
        /* ── Single Party View ── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '4px', height: '24px', background: currentTab.color, borderRadius: '2px' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#18181b' }}>
              {currentTab.label}
            </h3>
            <span style={{ color: '#a1a1aa', fontSize: '13px' }}>({getPartyList().length} جهة بأرصدة)</span>
          </div>
          <PartyTable entries={getPartyList()} color={currentTab.color} />
        </div>
      )}

      {allEntries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#a1a1aa' }}>
          <i className="fa-solid fa-scale-balanced" style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }} />
          <p style={{ fontWeight: 700, fontSize: '16px' }}>لا توجد ذمم مسجلة لهذه الفئة</p>
          <p style={{ fontSize: '13px' }}>الأرصدة تظهر هنا بعد تسجيل مبيعات أو مشتريات</p>
        </div>
      )}
    </div>
  );
}

function PartyTable({ entries, color }: { entries: any[]; color: string }) {
  if (!entries.length) return null;
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#f8f8f8' }}>
          <tr>
            <th style={thStyle}>الاسم</th>
            <th style={thStyle}>الهاتف</th>
            <th style={thStyle}>النوع</th>
            <th style={thStyle}>الاتجاه</th>
            <th style={thStyle}>الأرصدة</th>
            <th style={thStyle}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #f4f4f5', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={tdStyle}>
                <span style={{ fontWeight: 900, color: '#18181b' }}>{e.name}</span>
              </td>
              <td style={tdStyle}>
                <a href={`tel:${e.phone}`} style={{ color: '#0ea5e9', fontWeight: 700, textDecoration: 'none' }}>{e.phone || '—'}</a>
              </td>
              <td style={tdStyle}>
                <TypeBadge type={e.party_type === 'supplier' ? 'مزارع' : e.customer_type || 'تاجر'} />
              </td>
              <td style={tdStyle}>
                <span style={{
                  background: e.direction === 'payable' ? '#fef3c7' : '#d1fae5',
                  color: e.direction === 'payable' ? '#92400e' : '#065f46',
                  padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '12px',
                }}>
                  {e.direction === 'payable' ? '🧾 مستحق له (ندفع)' : '📥 مستحق علينا (يدفع)'}
                </span>
              </td>
              <td style={tdStyle}>
                {e.balances?.map((b: any, bi: number) => (
                  <div key={bi} style={{ fontWeight: 900, fontSize: '14px', color: e.direction === 'payable' ? '#059669' : '#0ea5e9', direction: 'ltr', textAlign: 'left' }}>
                    {parseFloat(b.balance).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {b.currency_symbol || b.currency_code}
                  </div>
                ))}
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {e.whatsapp && (
                    <a
                      href={`https://wa.me/${e.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم ${e.name}، يرجى مراجعة كشف حسابكم لدينا.`)}`}
                      target="_blank" rel="noreferrer"
                      title="إرسال واتساب"
                      style={{ background: '#d1fae5', color: '#059669', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}
                    >
                      <i className="fa-brands fa-whatsapp" />
                    </a>
                  )}
                  <a
                    href={e.party_type === 'supplier'
                      ? `/suppliers/${e.id}/statement`
                      : `/accounting/statement?type=customer&id=${e.id}`}
                    style={{ background: '#e0f2fe', color: '#0ea5e9', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}
                    title="كشف حساب"
                  >
                    <i className="fa-solid fa-file-invoice" />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: any; color: string; icon: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', border: `1px solid ${color}22`, padding: '18px 20px', borderRight: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', marginBottom: '4px' }}>{label}</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#18181b', direction: 'ltr' }}>{value}</div>
        </div>
        <div style={{ background: `${color}15`, borderRadius: '10px', padding: '10px', color }}>
          <i className={`fa-solid ${icon}`} style={{ fontSize: '18px' }} />
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'مزارع':   { bg: '#d1fae5', text: '#065f46' },
    'trader':  { bg: '#e0f2fe', text: '#0369a1' },
    'retail':  { bg: '#ede9fe', text: '#6d28d9' },
    'employee':{ bg: '#fef3c7', text: '#92400e' },
    'partner': { bg: '#fce7f3', text: '#9d174d' },
  };
  const style = colors[type] || { bg: '#f4f4f5', text: '#71717a' };
  return (
    <span style={{ background: style.bg, color: style.text, padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '11px' }}>
      {type}
    </span>
  );
}

const thStyle: React.CSSProperties = { padding: '12px', textAlign: 'right', fontWeight: 700, color: '#52525b', borderBottom: '2px solid #e4e4e7', fontSize: '13px' };
const tdStyle: React.CSSProperties = { padding: '12px' };
