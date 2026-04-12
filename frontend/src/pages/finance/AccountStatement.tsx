import React, { useState, useRef } from 'react';
import { api } from '../../api/baseApi';
import { SmartSearch } from '../../components/ui/SmartSearch';

const stmtApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query({ query: (s?: string) => `suppliers/${s ? `?search=${s}` : ''}`, }),
    getCustomers: build.query({ query: (s?: string) => `customers/${s ? `?search=${s}` : ''}`, }),
    getPartners: build.query({ query: (s?: string) => `partners/${s ? `?search=${s}` : ''}`, }),
    getSupplierStatement: build.query({
      query: ({ id, from, to }: any) => `suppliers/${id}/account-statement/${from && to ? `?from=${from}&to=${to}` : ''}`,
    }),
    getCustomerStatement: build.query({
      query: ({ id, from, to }: any) => `customers/${id}/account-statement/${from && to ? `?from=${from}&to=${to}` : ''}`,
    }),
    getPartnerStatement: build.query({
      query: ({ id, from, to }: any) => `partners/${id}/account-statement/${from && to ? `?from=${from}&to=${to}` : ''}`,
    }),
  }),
});

export const {
  useGetSuppliersQuery, useGetCustomersQuery, useGetPartnersQuery,
  useGetSupplierStatementQuery, useGetCustomerStatementQuery, useGetPartnerStatementQuery,
} = stmtApi;

type PartyType = 'supplier' | 'customer' | 'partner';

function fmt(n: number) {
  return n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
}

export default function AccountStatement() {
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: suppliersRaw } = useGetSuppliersQuery('');
  const { data: customersRaw } = useGetCustomersQuery('');
  const { data: partnersRaw } = useGetPartnersQuery('');

  const suppliers = suppliersRaw?.results || (Array.isArray(suppliersRaw) ? suppliersRaw : []);
  const customers = customersRaw?.results || (Array.isArray(customersRaw) ? customersRaw : []);
  const partners = partnersRaw?.results || (Array.isArray(partnersRaw) ? partnersRaw : []);

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    const type = new URLSearchParams(window.location.search).get('type');
    const id = new URLSearchParams(window.location.search).get('id');

    if (type && id) {
        setPartyType(type as PartyType);
        const list = type === 'supplier' ? suppliers : type === 'customer' ? customers : partners;
        const match = list.find((p: any) => p.id === id);
        if (match) setSelectedParty(match);
    } else if (q) {
      const all = [...suppliers, ...customers, ...partners];
      const match = all.find(p => p.name?.includes(q) || p.phone?.includes(q));
      if (match) {
        if (suppliers.find((s:any) => s.id === match.id)) setPartyType('supplier');
        else if (customers.find((s:any) => s.id === match.id)) setPartyType('customer');
        else setPartyType('partner');
        setSelectedParty(match);
      }
    }
  }, [suppliersRaw, customersRaw, partnersRaw]);

  const { data: supplierStmt, isFetching: sfetching } = useGetSupplierStatementQuery(
    { id: selectedParty?.id, from: dateFrom, to: dateTo },
    { skip: !selectedParty || partyType !== 'supplier' }
  );
  const { data: customerStmt, isFetching: cfetching } = useGetCustomerStatementQuery(
    { id: selectedParty?.id, from: dateFrom, to: dateTo },
    { skip: !selectedParty || partyType !== 'customer' }
  );
  const { data: partnerStmt, isFetching: pfetching } = useGetPartnerStatementQuery(
    { id: selectedParty?.id, from: dateFrom, to: dateTo },
    { skip: !selectedParty || partyType !== 'partner' }
  );

  const stmt = partyType === 'supplier' ? supplierStmt : partyType === 'customer' ? customerStmt : partnerStmt;
  const isFetching = sfetching || cfetching || pfetching;
  const entries = stmt?.entries || [];

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
    <div dir="rtl" className="animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-on-surface">كشوف الحسابات الموحدة</h2>
          <p className="text-zinc-500 font-bold mt-1">عرض تفصيلي لكل الحركات المالية للشركاء، المزارعين، والتجار.</p>
        </div>
        {selectedParty && (
            <button
              onClick={handleWhatsApp}
              className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg flex items-center gap-2"
            >
              📱 إرسال واتساب
            </button>
        )}
      </div>

      <div className="flex gap-2 mb-8 bg-zinc-100 p-1.5 rounded-2xl w-fit">
        {([
          { key: 'supplier', label: 'المزارعين' },
          { key: 'customer', label: 'التجار' },
          { key: 'partner', label: 'الشركاء' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setPartyType(tab.key); setSelectedParty(null); }}
            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${partyType === tab.key ? 'bg-white shadow-sm text-emerald-700' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-1">
          <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block">اختر الطرف</label>
          <SmartSearch
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={selectedParty?.name || ''}
            onSearch={async (q) => {
              const list = partyType === 'supplier' ? suppliers : partyType === 'customer' ? customers : partners;
              return (list as any[]).filter((p: any) =>
                p.name?.includes(q) || p.phone?.includes(q)
              );
            }}
            onSelect={(p) => setSelectedParty(p)}
            getLabel={(p) => p.name}
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block">من تاريخ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-2xl px-4 h-12 font-bold outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block">إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-2xl px-4 h-12 font-bold outline-none" />
        </div>
      </div>

      {selectedParty && stmt && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">الرصيد الافتتاحي</p>
                <div className="text-2xl font-black font-code text-zinc-800">0.00 ₪</div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">الرصيد الحالي</p>
                <div className={`text-3xl font-black font-code ${stmt.current_balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {fmt(Math.abs(stmt.current_balance))} ₪
                </div>
                <p className="text-[10px] font-black text-zinc-400 mt-1 uppercase">
                    {stmt.current_balance >= 0 ? 'مدين (له علينا)' : 'دائن (عليه لنا)'}
                </p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">إجمالي الحركات</p>
                <div className="text-2xl font-black font-code text-zinc-800">{entries.length}</div>
            </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">البيان</th>
                <th className="px-6 py-4">مدين (-)</th>
                <th className="px-6 py-4">دائن (+)</th>
                <th className="px-6 py-4">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {isFetching ? (
                  <tr><td colSpan={5} className="py-20 text-center font-bold text-zinc-400">جاري تحميل البيانات...</td></tr>
              ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center font-bold text-zinc-400">لا توجد حركات لعرضها.</td></tr>
              ) : entries.map((e: any, idx: number) => (
                  <tr key={idx} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 font-code text-sm text-zinc-500">{new Date(e.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-4 font-bold text-on-surface">{e.description}</td>
                      <td className="px-6 py-4 font-black font-code text-rose-600">{e.type === 'DR' ? fmt(e.foreign_amount) : ''}</td>
                      <td className="px-6 py-4 font-black font-code text-emerald-600">{e.type === 'CR' ? fmt(e.foreign_amount) : ''}</td>
                      <td className="px-6 py-4 font-black font-code text-zinc-800 bg-zinc-50/30">{fmt(Math.abs(e.balance))}</td>
                  </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}
