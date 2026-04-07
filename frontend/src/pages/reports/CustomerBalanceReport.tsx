import { useState } from 'react';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

const reportApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomerBalanceReport: build.query({
      query: () => 'customers/balance-report/',
      providesTags: ['Customers'],
    }),
  }),
});

export const { useGetCustomerBalanceReportQuery } = reportApi;

export default function CustomerBalanceReport() {
  const { data: report, isLoading } = useGetCustomerBalanceReportQuery({});
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = (report || []).filter((c: any) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = (type: 'A4' | 'A5') => {
    window.print();
  };

  const handleExportExcel = () => {
    // Basic CSV export as starting point for Excel
    const headers = ["رقم التاجر", "اسم التاجر", "الأرصدة", "رقم الهاتف", "آخر دفعة", "آخر فاتورة", "ملاحظات"];
    const rows = filteredData.map((c: any) => [
      c.id.substring(0,8),
      c.name,
      c.balances.map((b: any) => `${b.amount} ${b.currency_symbol}`).join(' / '),
      c.phone || '',
      c.last_payment_date ? new Date(c.last_payment_date).toLocaleDateString('ar-EG') : '---',
      c.last_invoice_date ? new Date(c.last_invoice_date).toLocaleDateString('ar-EG') : '---',
      c.notes || ''
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n"
      + rows.map((e: any[]) => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customer_balances_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (isLoading) return <TableSkeleton titleWidth="300px" rows={10} columns={7} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20 no-print">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-indigo-600">account_balance</span>
             كشف أرصدة الزبائن / التجار
          </h2>
          <p className="text-zinc-500 font-bold mt-1">تقرير شامل للمديونيات، تاريخ التحصيل، وحالة الحسابات الحالية.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => handlePrint('A4')} className="bg-white border-2 border-zinc-100 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:bg-zinc-50 transition-all shadow-sm">
              <span className="material-symbols-outlined">print</span>
              طباعة A4
           </button>
           <button onClick={handleExportExcel} className="bg-emerald-600 text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/20">
              <span className="material-symbols-outlined">description</span>
              تصدير إكسيل
           </button>
        </div>
      </header>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
         <div className="relative max-w-md w-full">
            <input 
              type="text" 
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 pr-12 focus:border-indigo-600 outline-none transition-all font-bold text-sm"
              placeholder="بحث باسم التاجر..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">person_search</span>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse print-table">
            <thead>
              <tr className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                <th className="px-6 py-5">رقم التاجر</th>
                <th className="px-6 py-5">اسم التاجر</th>
                <th className="px-6 py-5">الرصيد الجاري</th>
                <th className="px-6 py-5">رقم الهاتف</th>
                <th className="px-6 py-5">آخر دفعة</th>
                <th className="px-6 py-5">آخر فاتورة</th>
                <th className="px-6 py-5">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredData.map((c: any) => (
                <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-6 font-mono text-[10px] text-zinc-400">#{c.id.substring(0,8)}</td>
                  <td className="px-6 py-6 font-black text-zinc-700">{c.name}</td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-1">
                       {c.balances.map((b: any) => (
                         <div key={b.currency_code} className={`font-black ${b.amount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {Math.abs(b.amount).toLocaleString()} <span className="text-[10px] opacity-70">{b.currency_symbol}</span>
                         </div>
                       ))}
                       {c.balances.length === 0 && <span className="text-zinc-200">0.00</span>}
                    </div>
                  </td>
                  <td className="px-6 py-6 font-bold text-zinc-500" dir="ltr">{c.phone || '---'}</td>
                  <td className="px-6 py-6">
                     <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block">
                        {c.last_payment_date ? new Date(c.last_payment_date).toLocaleDateString('ar-EG') : '---'}
                     </div>
                  </td>
                  <td className="px-6 py-6">
                     <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg inline-block">
                        {c.last_invoice_date ? new Date(c.last_invoice_date).toLocaleDateString('ar-EG') : '---'}
                     </div>
                  </td>
                  <td className="px-6 py-6 text-xs text-zinc-400 max-w-[200px] truncate">{c.notes || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-table { width: 100% !important; border: 1px solid #eee !important; font-size: 10px !important; }
          .print-table th, .print-table td { border: 1px solid #eee !important; padding: 8px !important; }
        }
      `}</style>
    </div>
  );
}
