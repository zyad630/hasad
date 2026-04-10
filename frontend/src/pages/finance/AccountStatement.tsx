/**
 * Account Statements — Unified Statement Page (Request 8)
 * URL: /accounting/statement
 * Tabs: المزارعين | التجار | الزبائن
 * Features: Smart search, date filter, running balance, WhatsApp sharing
 */
import React, { useState, useRef } from 'react';
import { api } from '../../api/baseApi';
import { SmartSearch } from '../../components/ui/SmartSearch';

const stmtApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query({ query: (s?: string) => `suppliers/${s ? `?search=${s}` : ''}`, }),
    getCustomers: build.query({ query: (s?: string) => `customers/${s ? `?search=${s}` : ''}`, }),
    getSupplierStatement: build.query({
      query: ({ id, from, to }: any) => `suppliers/${id}/account-statement/${from && to ? `?from=${from}&to=${to}` : ''}`,
    }),
    getCustomerStatement: build.query({
      query: ({ id, from, to }: any) => `customers/${id}/account-statement/${from && to ? `?from=${from}&to=${to}` : ''}`,
    }),
  }),
});

export const {
  useGetSuppliersQuery, useGetCustomersQuery,
  useGetSupplierStatementQuery, useGetCustomerStatementQuery,
} = stmtApi;

type PartyType = 'supplier' | 'customer';

function fmt(n: number) {
  return n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
}

export default function AccountStatement() {
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: suppliersRaw, isError: sListErr, error: sListError, refetch: refetchSuppliers } = useGetSuppliersQuery('');
  const { data: customersRaw, isError: cListErr, error: cListError, refetch: refetchCustomers } = useGetCustomersQuery('');

  const suppliers = suppliersRaw?.results || (Array.isArray(suppliersRaw) ? suppliersRaw : []);
  const customers = customersRaw?.results || (Array.isArray(customersRaw) ? customersRaw : []);

  const { data: supplierStmt, isFetching: sfetching } = useGetSupplierStatementQuery(
    { id: selectedParty?.id, from: dateFrom, to: dateTo },
    { skip: !selectedParty || partyType !== 'supplier' }
  );
  const { data: customerStmt, isFetching: cfetching } = useGetCustomerStatementQuery(
    { id: selectedParty?.id, from: dateFrom, to: dateTo },
    { skip: !selectedParty || partyType !== 'customer' }
  );

  const stmt = partyType === 'supplier' ? supplierStmt : customerStmt;
  const isFetching = sfetching || cfetching;
  const entries = stmt?.entries || [];

  const listError = partyType === 'supplier' ? sListError : cListError;
  const hasListError = partyType === 'supplier' ? sListErr : cListErr;
  const retryList = () => {
    if (partyType === 'supplier') refetchSuppliers();
    else refetchCustomers();
  };

  const handleWhatsApp = () => {
    if (!selectedParty || !stmt) return;
    const phone = selectedParty.whatsapp_number || selectedParty.phone || '';
    const balance = stmt.current_balance || 0;
    const msg = encodeURIComponent(
      `كشف حساب - ${selectedParty.name}\n` +
      `الفترة: ${dateFrom || 'البداية'} إلى ${dateTo || 'اليوم'}\n` +
      `إجمالي الرصيد: ${fmt(balance)}\n` +
      `عدد الحركات: ${entries.length}`
    );
    const whatsappUrl = phone
      ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div style={{ direction: 'rtl' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-title">
        <div className="title-text">
          <h2>كشوف الحسابات</h2>
          <p>كشف حساب موحد لكل الأطراف — مزارعين، تجار، زبائن</p>
        </div>
        {selectedParty && (
          <div className="title-actions">
            <button
              onClick={handleWhatsApp}
              style={{ padding: '10px 18px', borderRadius: '12px', background: '#25d366', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📱 إرسال واتساب
            </button>
          </div>
        )}
      </div>

      {/* ── Party type tabs ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '14px', width: 'fit-content', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {([
          { key: 'supplier', label: '🌾 المزارعين / الموردين' },
          { key: 'customer', label: '🛒 التجار / الزبائن' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setPartyType(tab.key); setSelectedParty(null); }}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 800, fontSize: '13px',
              background: partyType === tab.key ? '#065f46' : 'transparent',
              color: partyType === tab.key ? 'white' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search & Filters ───────────────────────────────────────────── */}
      {hasListError && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', padding: '14px 16px', borderRadius: '14px', fontWeight: 800, marginBottom: '16px' }}>
          {(listError as any)?.data?.detail || (listError as any)?.data?.error || (listError as any)?.error || 'فشل تحميل قائمة الأطراف.'}
          <button onClick={retryList} style={{ marginRight: '10px', background: 'white', border: '1px solid #fecdd3', borderRadius: '10px', padding: '6px 10px', fontWeight: 800, cursor: 'pointer' }}>
            إعادة المحاولة
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', maxWidth: '320px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', marginBottom: '5px' }}>
            {partyType === 'supplier' ? 'اختر المزارع / المورد' : 'اختر التاجر / الزبون'}
          </label>
          <SmartSearch
            placeholder={partyType === 'supplier' ? 'ابحث عن المزارع...' : 'ابحث عن التاجر...'}
            value={selectedParty?.name || ''}
            onSearch={async (q) => {
              const list = partyType === 'supplier' ? suppliers : customers;
              return (list as any[]).filter((p: any) =>
                p.name?.includes(q) || p.phone?.includes(q)
              );
            }}
            onSelect={(p) => setSelectedParty(p)}
            getLabel={(p) => p.name}
            renderItem={(p) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{p.phone || ''}</span>
              </div>
            )}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', marginBottom: '5px' }}>من تاريخ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ height: '44px', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '0 10px', fontFamily: 'inherit', fontWeight: 600, outline: 'none', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', marginBottom: '5px' }}>إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ height: '44px', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '0 10px', fontFamily: 'inherit', fontWeight: 600, outline: 'none', fontSize: '13px' }} />
        </div>
      </div>

      {/* ── Statement summary card ─────────────────────────────────────── */}
      {selectedParty && stmt && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', flex: 1, minWidth: '160px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, marginBottom: '4px' }}>الطرف</div>
            <div style={{ fontWeight: 900, fontSize: '16px' }}>{stmt.supplier_name || stmt.customer_name}</div>
            {(stmt.phone) && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{stmt.phone}</div>}
          </div>
          <div style={{ background: (stmt.current_balance || 0) > 0 ? '#fef9c3' : '#f0fdf4', borderRadius: '14px', padding: '16px 20px', minWidth: '160px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, marginBottom: '4px' }}>الرصيد الحالي</div>
            <div style={{ fontWeight: 900, fontSize: '22px', fontFamily: 'monospace', color: (stmt.current_balance || 0) > 0 ? '#ca8a04' : '#059669' }}>
              {fmt(Math.abs(stmt.current_balance || 0))}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af' }}>
              {(stmt.current_balance || 0) > 0 ? 'مدين (له علينا)' : 'دائن (عليه لنا)'}
            </div>
          </div>
          <div style={{ background: '#f0f9ff', borderRadius: '14px', padding: '16px 20px', minWidth: '120px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, marginBottom: '4px' }}>عدد الحركات</div>
            <div style={{ fontWeight: 900, fontSize: '22px', color: '#0284c7', fontFamily: 'monospace' }}>{entries.length}</div>
          </div>
        </div>
      )}

      {/* ── Statement Table ────────────────────────────────────────────── */}
      {!selectedParty ? (
        <div style={{ background: 'white', borderRadius: '20px', padding: '60px', textAlign: 'center', color: '#d1d5db', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>اختر {partyType === 'supplier' ? 'مزارعاً أو مورداً' : 'تاجراً أو زبوناً'} لعرض كشف الحساب</div>
        </div>
      ) : isFetching ? (
        <div style={{ background: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f0fdf4' }}>
                {['التاريخ', 'رقم المستند', 'البيان', 'مدين', 'دائن', 'الرصيد'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#065f46', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>
                    لا توجد حركات في هذه الفترة
                  </td>
                </tr>
              ) : entries.map((entry: any, idx: number) => {
                const isDebit = entry.type === 'DR';
                const balanceColor = (entry.balance || 0) > 0 ? '#ca8a04' : '#059669';
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f9fafb', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {entry.date ? new Date(entry.date).toLocaleDateString('en-US') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '12px' }}>{entry.reference || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, maxWidth: '200px' }}>{entry.description || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, color: isDebit ? '#dc2626' : '#d1d5db' }}>
                      {isDebit ? fmt(entry.foreign_amount) : ''}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, color: !isDebit ? '#059669' : '#d1d5db' }}>
                      {!isDebit ? fmt(entry.foreign_amount) : ''}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 900, color: balanceColor }}>
                      {fmt(Math.abs(entry.balance_base || 0))}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              {entries.length > 0 && (
                <tr style={{ background: '#f0fdf4', fontWeight: 900 }}>
                  <td colSpan={4} style={{ padding: '12px 14px', color: '#065f46', fontWeight: 800 }}>الإجمالي</td>
                  <td style={{ padding: '12px 14px' }}></td>
                  <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '16px', color: '#065f46' }}>
                    {fmt(Math.abs(stmt?.current_balance || 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
