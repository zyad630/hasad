import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { useParams } from 'react-router-dom';
import { api, useSendWhatsAppAlertMutation } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

const supplierLedgerApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSupplierStatement: build.query({
      query: (id) => `suppliers/${id}/account-statement/`,
      providesTags: (result, error, id) => [{ type: 'Suppliers', id }],
    }),
  }),
});

export const { useGetSupplierStatementQuery } = supplierLedgerApi;

export default function SupplierStatement() {
  const { showToast } = useToast();
  const { id } = useParams();
  const { data: statement, isLoading } = useGetSupplierStatementQuery(id);
  const [sendWhatsAppAlert] = useSendWhatsAppAlertMutation();
  const [isSendingWA, setIsSendingWA] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = async () => {
    setIsSendingWA(true);
    const text = `كشف حساب المزارع: ${statement?.supplier_name}\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\nالأرصدة الحالية:\n${statement?.current_balances?.map((b: any) => `${b.amount} ${b.currency_symbol}`).join('\n')}`;
    
    try {
        await sendWhatsAppAlert({ phone: statement?.supplier_phone || '', text }).unwrap();
        showToast('تم إرسال كشف الحساب عبر الواتساب بنجاح!', 'success');
    } catch(err: any) {
        // Fallback to wa.me if backend API fails or credentials are not set
        window.open(`https://wa.me/${statement?.supplier_phone || ''}?text=${encodeURIComponent(text)}`);
    } finally {
        setIsSendingWA(false);
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="400px" rows={12} columns={6} />;


  return (
    <div className="space-y-8 animate-fade-in pb-20 no-print">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <button onClick={() => window.history.back()} className="text-zinc-400 hover:text-primary flex items-center gap-2 mb-2 font-bold transition-colors">
             <span className="material-symbols-outlined">arrow_right_alt</span>
             عودة للمزارعين
          </button>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">receipt_long</span>
             كشف حساب: {statement?.supplier_name}
          </h2>
          <p className="text-zinc-500 font-bold mt-1 opacity-70">سجل كامل للمشتريات، المدفوعات، والكمسيونات.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={handleSendWhatsApp} 
             disabled={isSendingWA}
             className="bg-emerald-600 text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <span className={`material-symbols-outlined ${isSendingWA ? 'animate-pulse' : ''}`}>chat</span>
              {isSendingWA ? 'جاري الإرسال...' : 'إرسال واتساب'}
           </button>
           <button onClick={handlePrint} className="bg-white border-2 border-zinc-100 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:bg-zinc-50 transition-all shadow-sm">
              <span className="material-symbols-outlined">print</span>
              طباعة الكشف
           </button>
        </div>
      </header>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {statement?.current_balances?.map((b: any) => (
           <div key={b.currency_code} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm border-r-4 border-r-emerald-600">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">الرصيد الحالي ({b.currency_name})</p>
              <h3 className={`text-2xl font-black mt-1 ${b.amount > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                 {Math.abs(b.amount).toLocaleString()} <span className="text-xs font-bold">{b.symbol || b.currency_symbol}</span>
                 <span className="text-[10px] text-zinc-400 mr-2">{b.amount > 0 ? '(له)' : '(عليه)'}</span>
              </h3>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
         <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse print-table">
               <thead>
                  <tr className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 italic">
                     <th className="px-6 py-5">تاريخ الحركة</th>
                     <th className="px-6 py-5">البيان / الوصف</th>
                     <th className="px-6 py-5">المرجع</th>
                     <th className="px-6 py-5">مدين (أخذ)</th>
                     <th className="px-6 py-5">دائن (له)</th>
                     <th className="px-6 py-5">الرصيد</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-zinc-50">
                  {statement?.entries?.map((e: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-50/20 transition-colors">
                       <td className="px-6 py-5">
                          <div className="text-sm font-bold text-zinc-600">{new Date(e.date).toLocaleDateString('ar-EG')}</div>
                          <div className="text-[10px] text-zinc-300">{new Date(e.date).toLocaleTimeString('ar-EG')}</div>
                       </td>
                       <td className="px-6 py-5 font-bold text-zinc-700 text-sm">{e.description}</td>
                       <td className="px-6 py-5 text-[10px] font-mono text-zinc-400 uppercase">
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">{e.reference.split('#')[0]}</span>
                          <span className="ml-1">#{e.reference.split('#')[1]?.substring(0,6)}</span>
                       </td>
                       <td className="px-6 py-5 font-black text-rose-600">{e.type === 'DR' ? parseFloat(e.amount).toLocaleString() : '---'}</td>
                       <td className="px-6 py-5 font-black text-emerald-700">{e.type === 'CR' ? parseFloat(e.amount).toLocaleString() : '---'}</td>
                       <td className="px-6 py-5 font-black text-zinc-400 text-xs">---</td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-family: 'Cairo', sans-serif; direction: rtl; }
          .print-table { width: 100% !important; border: 1px solid #333 !important; font-size: 11px !important; }
          .print-table th, .print-table td { border: 1px solid #ddd !important; padding: 10px !important; }
          .print-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        }
      `}</style>

      {/* Print-only template */}
      <div className="hidden print:block p-8">
         <div className="flex justify-between items-end border-b-4 border-emerald-900 pb-6 mb-8">
            <div>
               <h1 className="text-4xl font-black text-emerald-900">حَصاد</h1>
               <p className="text-sm font-bold text-zinc-500">لإدارة الحِسبة وتجارة الخضار والفاكهة</p>
            </div>
            <div className="text-left">
               <h2 className="text-2xl font-black">كشف حساب مزارع</h2>
               <p className="text-sm font-bold text-zinc-400">{new Date().toLocaleDateString('ar-EG')}</p>
            </div>
         </div>
         
         <div className="mb-8">
            <h3 className="text-xl font-bold bg-zinc-100 p-3 rounded-lg border border-zinc-200 inline-block">السيد المزارع: {statement?.supplier_name}</h3>
         </div>

         {/* The table will render via the CSS above */}
      </div>

    </div>
  );
}
