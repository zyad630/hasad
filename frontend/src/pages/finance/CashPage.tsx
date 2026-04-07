import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { useGetCurrenciesQuery } from '../settings/Currencies';

const cashApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCashBalance: build.query({
      query: () => 'finance/cash/balance/',
      providesTags: ['Cash'],
    }),
    getCashTransactions: build.query({
      query: () => 'finance/cash/',
      providesTags: ['Cash'],
    }),
    createVoucher: build.mutation({
      query: (body) => ({
        url: 'finance/cash/voucher/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Cash'],
    }),
  }),
});

export const { useGetCashBalanceQuery, useGetCashTransactionsQuery, useCreateVoucherMutation } = cashApi;

interface VoucherEntry {
  type: 'cash' | 'check';
  amount?: string; // Legacy API support
  debit: string;
  credit: string;
  check_number?: string;
  bank_name?: string;
  bank_code?: string;
  due_date?: string;
  account_name?: string;
  account_id?: string;
}

export default function CashPage() {
  const { showToast } = useToast();
  const { data: balanceData, isLoading: loadingBalance } = useGetCashBalanceQuery({});
  const { data: transactions, isLoading: loadingTx } = useGetCashTransactionsQuery({});
  const { data: currencies } = useGetCurrenciesQuery({});
  const [createVoucher] = useCreateVoucherMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState<'in' | 'out'>('in');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [description, setDescription] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [entries, setEntries] = useState<VoucherEntry[]>([{ 
    type: 'cash', debit: '', credit: '', 
    account_name: 'صندوق نقدي', account_id: '1111' 
  }]);

  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [agent, setAgent] = useState('');

  const addEntry = (type: 'cash' | 'check') => {
    setEntries([...entries, { 
      type, 
      debit: '',
      credit: '', 
      check_number: type === 'check' ? '' : undefined,
      bank_name: type === 'check' ? '' : undefined,
      bank_code: type === 'check' ? '' : undefined,
      due_date: type === 'check' ? docDate : undefined,
      account_name: type === 'cash' ? 'صندوق نقدي' : 'صندوق الشيكات',
      account_id: type === 'cash' ? '1111' : '1121'
    }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    } else {
      showToast('يجب أن يحتوي السند على سطر واحد على الأقل', 'warning');
    }
  };

  const updateEntry = (index: number, field: keyof VoucherEntry, value: any) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  // Calculate total: sum of any populated amount (debit or credit)
  const totalAmount = entries.reduce((sum, entry) => sum + (parseFloat(entry.debit) || parseFloat(entry.credit) || 0), 0);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    console.log('Submitting Voucher...', { txType, currencyCode, entries });
    
    if (!receivedFrom.trim()) {
       showToast('يرجى إدخال اسم المستلم / الدافع', 'warning');
       return;
    }

    if (entries.some(e => !e.debit && !e.credit)) {
       showToast('يرجى التأكد من المبالغ (دائن أو مدين) في جميع السطور', 'warning');
       return;
    }
    
    try {
      const response = await createVoucher({
        tx_type: txType,
        currency_code: currencyCode,
        description,
        received_from: receivedFrom,
        entries: entries.map(e => ({ 
           ...e, 
           amount: parseFloat(e.debit) || parseFloat(e.credit) || 0 
        }))
      }).unwrap();
      
      console.log('Success:', response);
      setIsModalOpen(false);
      resetForm();
      showToast('تم حفظ السند بنجاح', 'success');
    } catch (err: any) {
      console.error('Submit Error:', err);
      const errorMsg = err?.data?.error || err?.data?.detail || 'خطأ في البيانات أو اتصال السيرفر';
      showToast(`عذراً، فشل الحفظ: ${errorMsg}`, 'info');
    }
  };

  const resetForm = () => {
    setEntries([{ 
      type: 'cash', debit: '', credit: '', 
      account_name: 'صندوق نقدي', account_id: '1111' 
    }]);
    setDescription('');
    setReceivedFrom('');
    setAgent('');
    setCurrencyCode('ILS');
    setDocDate(new Date().toISOString().split('T')[0]);
  };

  const getReferenceLabel = (type: string) => {
    const labels: Record<string, string> = {
      sale: 'بيع نقدي',
      voucher: 'سند مجمع',
      settlement: 'تصفية مزارع',
      expense: 'مصروفات',
      manual: 'حركة يدوية',
    };
    return labels[type] || type;
  };

  const getCurrencySymbol = (code: string) => {
    if (code === 'ILS') return '₪';
    const found = currencies?.find((c: any) => c.code === code);
    return found?.symbol || code;
  };

  const getCurrencyName = (code: string) => {
    if (code === 'ILS') return 'شيكل إسرائيلي';
    const found = currencies?.find((c: any) => c.code === code);
    return found?.name || code;
  };

  if (loadingBalance || loadingTx) return <VegetableLoader text="جاري تحميل أرصدة الخزينة وحركة الأموال..." fullScreen={false} />;

  const balances = balanceData?.balances || [];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-emerald-600">account_balance_wallet</span>
            الخزينة وحركة الأموال
          </h2>
          <p className="text-zinc-500 font-bold mt-1">إدارة السيولة النقدية، الشيكات، وسندات القبض والصرف.</p>
        </div>
        <div className="flex gap-4">
          <button 
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            onClick={() => { setTxType('in'); setIsModalOpen(true); }}>
            <span className="material-symbols-outlined">add_card</span> سند قبض (نقدي/شيكات)
          </button>
          <button 
            className="flex items-center gap-2 px-8 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            onClick={() => { setTxType('out'); setIsModalOpen(true); }}>
            <span className="material-symbols-outlined">payments</span> سند صرف / دفع
          </button>
        </div>
      </div>

      {/* Currency Balances Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {balances.map((b: any) => (
          <div key={b.currency_code} className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 relative overflow-hidden group hover:border-emerald-600 transition-all">
             <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                   <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center font-black text-emerald-600 text-xl text-center">
                      {getCurrencySymbol(b.currency_code)}
                   </div>
                   <span className="px-3 py-1 bg-zinc-100 text-zinc-400 text-[10px] font-black rounded-lg uppercase tracking-widest">{b.currency_code}</span>
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">الرصيد المتاح</p>
                <h3 className="text-3xl font-black text-on-surface tracking-tight">
                  {parseFloat(b.balance || 0).toLocaleString()} <span className="text-xs font-bold text-zinc-400">{getCurrencyName(b.currency_code).split(' ')[0]}</span>
                </h3>
                <div className="mt-4 pt-4 border-t border-zinc-50 flex justify-between">
                   <div className="text-emerald-600 font-bold text-xs flex flex-col">
                      <span className="text-[9px] text-zinc-400">وارد (+)</span>
                      {parseFloat(b.total_in).toLocaleString()}
                   </div>
                   <div className="text-rose-600 font-bold text-xs flex flex-col items-end">
                      <span className="text-[9px] text-zinc-400">صادر (-)</span>
                      {parseFloat(b.total_out).toLocaleString()}
                   </div>
                </div>
             </div>
             <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[120px] text-zinc-500/5 group-hover:rotate-12 transition-transform">currency_exchange</span>
          </div>
        ))}
      </div>

      {/* Transactions History */}
      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <header className="px-8 py-6 border-b border-zinc-50 flex items-center justify-between">
           <h4 className="font-black text-xl text-on-surface flex items-center gap-2 tracking-tight">
             <span className="material-symbols-outlined text-emerald-600">history_edu</span>
             سجل حركات الخزينة
           </h4>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-5">تاريخ الحركة</th>
                <th className="px-6 py-5">نوع السند</th>
                <th className="px-6 py-5">المبلغ والعملة</th>
                <th className="px-6 py-5">البيان والتفاصيل</th>
                <th className="px-8 py-5 text-center">المرجع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(transactions || []).map((tx: any) => (
                <tr key={tx.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="text-xs font-bold text-zinc-500 font-code" dir="ltr">{new Date(tx.tx_date).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-6">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${tx.tx_type === 'in' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                       <span className="material-symbols-outlined text-[14px]">{tx.is_check ? 'description' : (tx.tx_type === 'in' ? 'add_box' : 'payments')}</span>
                       {tx.is_check ? 'شيك' : (tx.tx_type === 'in' ? 'قبض نقدي' : 'صرف نقدي')}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="text-lg font-black text-zinc-700">
                       {parseFloat(tx.amount).toLocaleString()} 
                       <span className="text-[10px] bg-zinc-100 text-zinc-400 px-2 py-0.5 rounded ml-2 uppercase">{tx.currency_code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 font-bold text-sm text-zinc-500 max-w-sm truncate">{tx.description}</td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-[10px] font-black text-zinc-300 uppercase tracking-tighter">#{getReferenceLabel(tx.reference_type)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-item Voucher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl animate-fade-in flex flex-col max-h-[95vh] overflow-hidden border border-zinc-100 relative">
             
             {/* Modal Header */}
             <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${txType === 'in' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}>
                     <span className="material-symbols-outlined text-2xl">{txType === 'in' ? 'add_card' : 'payments'}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface leading-tight">تسجيل سند {txType === 'in' ? 'قبض مالي' : 'صرف مالي'}</h3>
                    <p className="text-zinc-400 text-[10px] font-bold">يرجى ملء تفاصيل المبالغ النقدية و/أو الشيكات.</p>
                  </div>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 transition-colors shadow-sm cursor-pointer border border-zinc-100">
                  <span className="material-symbols-outlined">close</span>
               </button>
             </div>

             <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50/30">
                  
                  {/* ERP Style Top Header */}
                  <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">تاريخ المستند</label>
                         <input type="date" value={docDate} onChange={(e)=>setDocDate(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none transition-colors h-11" />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">مقبوض من / دفع لـ</label>
                         <input value={receivedFrom} onChange={(e)=>setReceivedFrom(e.target.value)} placeholder="اسم الشخص أو المزارع..." className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none transition-colors h-11" />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">المندوب (اختياري)</label>
                         <input value={agent} onChange={(e)=>setAgent(e.target.value)} placeholder="اسم المندوب..." className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none transition-colors h-11" />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">العملة</label>
                         <select value={currencyCode} onChange={(e)=>setCurrencyCode(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none transition-colors h-11">
                               <option value="ILS">شيكل إسرائيلي (₪)</option>
                               <option value="USD">دولار أمريكي ($)</option>
                               <option value="JOD">دينار أردني (د)</option>
                               <option value="EGP">جنيه مصري (E£)</option>
                             </select>
                       </div>

                       <div className="space-y-1 md:col-span-4 mt-2">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">البيان العام (شرح المستند)</label>
                         <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="مثال: دفعة تحت الحساب عن موسم 2024..." className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none transition-colors h-11" />
                       </div>
                    </div>
                  </div>

                  {/* ERP Style Grid Table */}
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                     <div className="bg-zinc-50 border-b border-zinc-100 p-2 flex gap-2">
                        <button type="button" onClick={() => addEntry('cash')} className="bg-white border border-emerald-600 text-emerald-700 text-[11px] px-4 py-2 rounded-xl font-bold hover:bg-emerald-600 hover:text-white active:scale-95 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
                           <span className="material-symbols-outlined text-[16px]">payments</span> سطر نقدى
                        </button>
                        <button type="button" onClick={() => addEntry('check')} className="bg-white border border-indigo-600 text-indigo-700 text-[11px] px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 hover:text-white active:scale-95 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
                           <span className="material-symbols-outlined text-[16px]">description</span> سطر شيكات
                        </button>
                     </div>
                     
                     <div className="overflow-x-auto">
                       <table className="w-full text-right border-collapse min-w-[1000px]">
                         <thead>
                           <tr className="bg-zinc-100/80 text-zinc-600 text-[11px] font-black border-y border-zinc-200 shadow-sm uppercase tracking-tighter">
                              <th className="px-2 py-3 w-12 text-center border-x border-zinc-200">#</th>
                              <th className="px-3 py-3 min-w-[140px] border-x border-zinc-200">اسم البنك</th>
                              <th className="px-3 py-3 w-24 text-center border-x border-zinc-200">كود البنك</th>
                              <th className="px-3 py-3 w-32 border-x border-zinc-200">تاريخ الاستحقاق</th>
                              <th className="px-3 py-3 w-28 border-x border-zinc-200">رقم الشيك</th>
                              <th className="px-3 py-3 w-28 border-x border-zinc-200 bg-emerald-50 text-emerald-700">دائن (+)</th>
                              <th className="px-3 py-3 w-28 border-x border-zinc-200 bg-sky-50 text-sky-700">مدين (-)</th>
                              <th className="px-3 py-3 min-w-[160px] border-x border-zinc-200">اسم الحساب</th>
                              <th className="px-3 py-3 w-24 text-center border-x border-zinc-200">رقم الحساب</th>
                           </tr>
                         </thead>
                         <tbody>
                           {entries.map((entry, idx) => (
                              <tr key={idx} className={`border-b border-zinc-100 bg-white hover:bg-zinc-50 transition-colors focus-within:bg-emerald-50/20 ${entry.type === 'cash' ? 'border-r-4 border-r-amber-500' : 'border-r-4 border-r-indigo-500'}`}>
                                <td className="px-1 py-2 text-center font-bold text-zinc-400 text-[10px] relative border-x border-zinc-100">
                                   {idx + 1}
                                   <button type="button" onClick={() => removeEntry(idx)} className="absolute inset-y-0 left-0 bg-rose-50 border border-rose-100 text-rose-500 w-7 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm cursor-pointer rounded-r z-10">
                                      <span className="material-symbols-outlined text-[16px]">close</span>
                                   </button>
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input disabled={entry.type === 'cash'} value={entry.bank_name || ''} onChange={(e)=>updateEntry(idx, 'bank_name', e.target.value)} placeholder={entry.type === 'cash' ? '' : 'بنك فلسطين...'} className="w-full bg-transparent border-none px-2 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg disabled:opacity-20 transition-all" />
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input disabled={entry.type === 'cash'} value={entry.bank_code || ''} onChange={(e)=>updateEntry(idx, 'bank_code', e.target.value)} className="w-full bg-transparent border-none px-2 py-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg disabled:opacity-20 transition-all font-code" />
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input type="date" disabled={entry.type === 'cash'} value={entry.due_date || ''} onChange={(e)=>updateEntry(idx, 'due_date', e.target.value)} className="w-full bg-transparent border-none px-2 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg disabled:opacity-20 transition-all uppercase" />
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input disabled={entry.type === 'cash'} value={entry.check_number || ''} onChange={(e)=>updateEntry(idx, 'check_number', e.target.value)} className="w-full bg-transparent border-none px-2 py-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg disabled:opacity-20 transition-all font-code" />
                                </td>
                                <td className="px-1 py-1 bg-emerald-50/10 border-x border-zinc-100">
                                   <input type="number" step="0.01" value={entry.credit || ''} onChange={(e)=>updateEntry(idx, 'credit', e.target.value)} placeholder="0.00" className="w-full bg-transparent border-none px-2 py-2 text-[13px] font-black text-left outline-none focus:ring-1 focus:ring-emerald-600 rounded-lg text-emerald-700 tabular-nums" dir="ltr" />
                                </td>
                                <td className="px-1 py-1 bg-sky-50/10 border-x border-zinc-100">
                                   <input type="number" step="0.01" value={entry.debit || ''} onChange={(e)=>updateEntry(idx, 'debit', e.target.value)} placeholder="0.00" className="w-full bg-transparent border-none px-2 py-2 text-[13px] font-black text-left outline-none focus:ring-1 focus:ring-sky-600 rounded-lg text-sky-700 tabular-nums" dir="ltr" />
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input value={entry.account_name || ''} onChange={(e)=>updateEntry(idx, 'account_name', e.target.value)} className={`w-full bg-transparent border-none px-2 py-2 text-[11px] font-black outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg ${entry.type==='cash' ? 'text-amber-700' : 'text-indigo-700'}`} />
                                </td>
                                <td className="px-1 py-1 border-x border-zinc-100">
                                   <input value={entry.account_id || ''} onChange={(e)=>updateEntry(idx, 'account_id', e.target.value)} className="w-full bg-transparent border-none px-2 py-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg text-zinc-400 font-code" />
                                </td>
                              </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-8 border-t border-zinc-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] relative z-20">
                   <div className="flex gap-10">
                      <div>
                         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">إجمالي مبلغ السند</p>
                         <h4 className="text-4xl font-black text-emerald-600 tracking-tighter tabular-nums flex items-baseline gap-1">
                           {totalAmount.toLocaleString()} <span className="text-[11px] font-bold text-zinc-400 uppercase">{currencyCode}</span>
                         </h4>
                      </div>
                      <div className="border-r border-zinc-100 ps-10">
                         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">عدد البنود</p>
                         <h4 className="text-4xl font-black text-zinc-800 tracking-tighter tabular-nums">{entries.length}</h4>
                      </div>
                   </div>
                   <div className="flex gap-4 w-full md:w-auto">
                      <button 
                        type="submit"
                        className="flex-1 md:flex-none px-14 h-15 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer outline-none focus:ring-4 focus:ring-emerald-100">
                         اعتماد السند الآن
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 h-15 bg-white border border-zinc-200 text-zinc-400 rounded-2xl font-bold hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer outline-none">إلغاء</button>
                   </div>
                </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
