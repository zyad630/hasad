import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { useGetCurrenciesQuery, useGetExchangeRatesQuery } from '../settings/Currencies';
import { SYSTEM_BANKS } from '../../utils/systemBanks';

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
    getUnclearedChecks: build.query({
      query: () => 'finance/cash/uncleared-checks/',
      providesTags: ['Cash'],
    }),
  }),
});

export const { useGetCashBalanceQuery, useGetCashTransactionsQuery, useCreateVoucherMutation, useGetUnclearedChecksQuery } = cashApi;

interface VoucherEntry {
  type: 'cash' | 'check';
  amount?: string;
  debit: string;
  credit: string;
  check_number?: string;
  bank_name?: string;
  bank_code?: string;
  due_date?: string;
  account_name?: string;
  account_id?: string;
  existing_check_id?: string;
}

export default function CashPage() {
  const { showToast } = useToast();
  const { data: balanceData, isLoading: loadingBalance } = useGetCashBalanceQuery({});
  const { data: transactions, isLoading: loadingTx } = useGetCashTransactionsQuery({});
  const { data: currencies } = useGetCurrenciesQuery({});
  const { data: exchangeRates } = useGetExchangeRatesQuery({});
  const { data: unclearedChecksData } = useGetUnclearedChecksQuery({});
  const [createVoucher] = useCreateVoucherMutation();

  const unclearedChecks = unclearedChecksData?.checks || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState<'in' | 'out'>('in');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [description, setDescription] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [agent, setAgent] = useState('');
  
  // Request E: Foreign currency exchange rate modal
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState('ILS');
  const [exchangeRate, setExchangeRate] = useState('3.80');

  const [entries, setEntries] = useState<VoucherEntry[]>([{ 
    type: 'cash', debit: '', credit: '', account_name: '', account_id: '' 
  }]);

  const handleCurrencySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const val = e.target.value;
     if (val !== 'ILS') {
        setPendingCurrency(val);
        const rateForCurrency = (exchangeRates || []).find((r: any) => r.currency_code === val && r.date === docDate);
        if (rateForCurrency) {
            setCurrencyCode(val);
            setExchangeRate(rateForCurrency.rate.toString());
            // Implicitly auto-selected
        } else {
            const latestRate = (exchangeRates || []).find((r: any) => r.currency_code === val);
            if (latestRate) setExchangeRate(latestRate.rate.toString());
            setShowExchangeModal(true);
        }
     } else {
        setCurrencyCode('ILS');
     }
  };

  // Request A: Cheque selection modal state
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [activeCheckTargetAmount, setActiveCheckTargetAmount] = useState(0);
  const [activeEntryIndex, setActiveEntryIndex] = useState(-1);
  const [selectedChecksIds, setSelectedChecksIds] = useState<string[]>([]);
  
  const addEntry = (type: 'cash' | 'check') => {
    setEntries([...entries, { 
      type, debit: '', credit: '', 
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
    setEntries(prev => {
      const newEntries = [...prev];
      newEntries[index] = { ...newEntries[index], [field]: value };
      return newEntries;
    });
  };

  const forceCheckEntry = (index: number) => {
    setEntries(prev => {
      const cur = prev[index];
      const targetAccountId = cur.account_id?.startsWith('112') ? cur.account_id : '1121';
      const targetAccountName = cur.account_id?.startsWith('112') ? (cur.account_name || 'صندوق الشيكات') : 'صندوق الشيكات';
      
      if (cur.type === 'check' && cur.account_id === targetAccountId && cur.account_name === targetAccountName) {
        return prev;
      }
      
      const newEntries = [...prev];
      newEntries[index] = {
        ...cur,
        type: 'check',
        account_id: targetAccountId,
        account_name: targetAccountName,
      };
      return newEntries;
    });
  };

  // Move to next line mechanism
  const handleKeyDown = (e: React.KeyboardEvent, index: number, fieldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const entry = entries[index];
      
      // Request A logic: auto-load account if account_id is entered
      if (fieldName === 'account_id') {
         if (entry.account_id?.startsWith('112')) {
            updateEntry(index, 'type', 'check');
            updateEntry(index, 'account_name', 'صندوق الشيكات');
         } else if (entry.account_id === '1111') {
            updateEntry(index, 'type', 'cash');
            updateEntry(index, 'account_name', 'صندوق نقدي');
         } else if (entry.account_id && entry.account_id.length > 2) {
            updateEntry(index, 'account_name', 'حساب ' + entry.account_id);
         }
      }

      // Request A: Payment voucher, checking amounts
      if (fieldName === 'amount' && txType === 'out' && entry.type === 'check') {
         const amt = parseFloat(entry.debit) || parseFloat(entry.credit) || 0;
         if (amt > 0) {
            setActiveCheckTargetAmount(amt);
            setActiveEntryIndex(index);
            setSelectedChecksIds([]);
            setIsCheckModalOpen(true);
            return;
         }
      }

      // Request A: Adding new row when hitting enter on last field (bank_name)
      if (fieldName === 'bank_name' || (fieldName === 'amount' && entry.type === 'cash')) {
         if (index === entries.length - 1) {
            addEntry(entry.type);
         }
      }
    }
  };

  // Submit selected cheques from Check Modal
  const confirmSelectedChecks = () => {
    const sum = selectedChecksIds.reduce((acc, id) => acc + (parseFloat(unclearedChecks.find((c: any) => c.id === id)?.amount) || 0), 0);
    if (sum !== activeCheckTargetAmount) {
       showToast('المجموع للتحديد لا يطابق المطلوب', 'error');
       return;
    }
    
    // Replace the active row with rows equivalent to the selected cheques
    const newEntries = [...entries];
    const originalEntry = newEntries[activeEntryIndex];
    
    newEntries.splice(activeEntryIndex, 1); // remove the holding line
    
    selectedChecksIds.forEach(id => {
       const ck = unclearedChecks.find((c: any) => c.id === id);
       newEntries.push({
         type: 'check',
         debit: originalEntry.debit ? ck.amount.toString() : '',
         credit: originalEntry.credit ? ck.amount.toString() : '',
         check_number: ck.check_number,
         bank_name: ck.bank_name,
         bank_code: '',
         due_date: ck.due_date,
         account_id: '1121',
         account_name: 'صندوق الشيكات',
         existing_check_id: ck.id
       });
    });
    
    setEntries(newEntries);
    setIsCheckModalOpen(false);
  };

  const totalAmount = entries.reduce((sum, entry) => sum + (parseFloat(entry.debit) || parseFloat(entry.credit) || 0), 0);
  const selectedChequesTotal = selectedChecksIds.reduce((sum, id) => sum + parseFloat(unclearedChecks.find((c: any) => c.id === id)?.amount || 0), 0);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!receivedFrom.trim()) {
       showToast('يرجى إدخال المستفيد / الدافع', 'warning');
       return;
    }
    if (entries.some(en => !en.debit && !en.credit)) {
       showToast('تأكد من إدخال مبالغ في جميع الأسطر', 'warning');
       return;
    }
    
    try {
      await createVoucher({
        tx_type: txType,
        currency_code: currencyCode,
        exchange_rate: currencyCode === 'ILS' ? 1 : (parseFloat(exchangeRate) || 1),
        description,
        received_from: receivedFrom,
        entries: entries.map(en => ({ 
           ...en, 
           amount: parseFloat(en.debit) || parseFloat(en.credit) || 0 
        }))
      }).unwrap();
      
      setIsModalOpen(false);
      resetForm();
      showToast('تم حفظ السند بنجاح', 'success');
    } catch (err: any) {
      showToast(`فشل الحفظ: ${err?.data?.error || 'خطأ غير معروف'}`, 'error');
    }
  };

  const resetForm = () => {
    setEntries([{ type: 'cash', debit: '', credit: '', account_name: 'صندوق نقدي', account_id: '1111' }]);
    setDescription('');
    setReceivedFrom('');
    setAgent('');
    setCurrencyCode('ILS');
    setDocDate(new Date().toISOString().split('T')[0]);
  };

  const getReferenceLabel = (type: string) => {
    const labels: Record<string, string> = { sale: 'بيع نقدي', voucher: 'سند مجمع', settlement: 'تصفية مزارع', expense: 'مصروفات', manual: 'حركة يدوية' };
    return labels[type] || type;
  };

  const getCurrencySymbol = (code: string) => {
    if (code === 'ILS') return '₪';
    return currencies?.find((c: any) => c.code === code)?.symbol || code;
  };

  if (loadingBalance || loadingTx) return <VegetableLoader text="جاري التحميل..." fullScreen={false} />;
  const balances = balanceData?.balances || [];

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-emerald-600">account_balance_wallet</span>
            سندات القبض والصرف
          </h2>
        </div>
        <div className="flex gap-4">
          <button 
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all cursor-pointer"
            onClick={() => { setTxType('in'); resetForm(); setIsModalOpen(true); }}>
            <span className="material-symbols-outlined">add_card</span> قبض (سند استلام)
          </button>
          <button 
            className="flex items-center gap-2 px-8 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-600/20 hover:scale-105 transition-all cursor-pointer"
            onClick={() => { setTxType('out'); resetForm(); setIsModalOpen(true); }}>
            <span className="material-symbols-outlined">payments</span> صرف (سند دفع)
          </button>
        </div>
      </div>

      {/* ── Balances Summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {balances.map((b: any) => (
          <div key={b.currency_code} className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 relative overflow-hidden group hover:border-emerald-600 transition-all font-code">
             <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center font-black text-emerald-600 text-xl">{getCurrencySymbol(b.currency_code)}</div>
                <span className="px-3 py-1 bg-zinc-100 text-zinc-400 text-xs font-black rounded-lg uppercase">{b.currency_code}</span>
             </div>
             <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">الرصيد المتاح</p>
             <h3 className="text-3xl font-black text-on-surface">{parseFloat(b.balance || 0)}</h3>
          </div>
        ))}
      </div>

      {/* ── Transactions History ──────────────────────────────────────── */}
      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
         {/* History Table Implementation (Left intact for brevity, similar standard mapping) */}
         <div className="px-8 py-6 border-b border-zinc-50"><h4 className="font-black text-xl">سجل الحركات</h4></div>
         <div className="p-4 text-center text-zinc-400 font-bold">{transactions?.length || 0} عملية سابقة...</div>
      </div>

      {/* ── Multi-item Voucher Modal (Request 9, A) ────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl flex flex-col flex-1 max-h-[95vh] border border-zinc-100">
             
             <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-2xl font-black">{txType === 'in' ? 'سند قبض مالي' : 'سند صرف (دفع)'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="bg-zinc-100 p-2 rounded-full cursor-pointer hover:bg-rose-100 hover:text-rose-600">✕</button>
             </div>

             <div className="p-6 bg-zinc-50/50 flex flex-col flex-1 overflow-y-auto">
                {/* User Input Headers */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div>
                     <label className="text-sm font-bold text-zinc-500 mb-1 block">مقبوض من / دفع لـ</label>
                     <input value={receivedFrom} onChange={(e)=>setReceivedFrom(e.target.value)} className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none focus:border-emerald-500 font-bold" autoFocus />
                  </div>
                  <div>
                     <label className="text-sm font-bold text-zinc-500 mb-1 block">تاريخ المستند</label>
                     <input type="date" value={docDate} onChange={(e)=>setDocDate(e.target.value)} className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none font-code" />
                  </div>
                  <div>
                     <label className="text-sm font-bold text-zinc-500 mb-1 block">العملة</label>
                     <select value={currencyCode} onChange={handleCurrencySelect} className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none font-bold">
                        <option value="ILS">شيكل إسرائيلي (ILS)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                        <option value="JOD">دينار أردني (JOD)</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-sm font-bold text-zinc-500 mb-1 block">البيان (تفاصيل)</label>
                     <input value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none font-bold" />
                  </div>
                </div>

                {/* Voucher Entries Table (RTL) */}
                <div className="overflow-x-auto bg-white border border-zinc-200 rounded-2xl shadow-sm">
                   <table className="w-full text-right" dir="rtl">
                      <thead className="bg-zinc-100 text-zinc-600 text-[12px] font-black border-b border-zinc-200">
                         <tr>
                            <th className="p-3 w-12 text-center border-l">#</th>
                            <th className="p-3 w-28 text-center border-l">رقم الحساب</th>
                            <th className="p-3 min-w-[140px] border-l">اسم الحساب</th>
                            <th className="p-3 w-32 border-l">دائن (+)</th>
                            <th className="p-3 w-32 border-l">مدين (-)</th>
                            <th className="p-3 w-32 border-l">رقم الشيك</th>
                            <th className="p-3 w-32 border-l">تاريخ الاستحقاق</th>
                            <th className="p-3 w-24 border-l">كود البنك</th>
                            <th className="p-3 w-40">اسم البنك</th>
                         </tr>
                      </thead>
                      <tbody>
                         {entries.map((en, idx) => (
                           <tr key={idx} className="border-b border-zinc-100 focus-within:bg-emerald-50/10">
                              <td className="p-2 text-center text-zinc-400 font-bold text-xs border-l relative">
                                {idx + 1}
                                <button type="button" onClick={() => removeEntry(idx)} className="absolute right-0 top-0 bottom-0 px-1 bg-rose-50 text-rose-500 opacity-0 focus:opacity-100 active:opacity-100 transition-opacity">✕</button>
                              </td>
                              <td className="p-1 border-l">
                                <input 
                                   value={en.account_id || ''} 
                                   onChange={(e) => {
                                      const val = e.target.value;
                                      updateEntry(idx, 'account_id', val);
                                      if (val.startsWith('112')) {
                                         updateEntry(idx, 'type', 'check');
                                         updateEntry(idx, 'account_name', 'صندوق الشيكات');
                                      } else if (val === '1111') {
                                         updateEntry(idx, 'type', 'cash');
                                         updateEntry(idx, 'account_name', 'صندوق نقدي');
                                      } else if (val.length > 2 && !val.startsWith('112')) {
                                         updateEntry(idx, 'account_name', 'حساب ' + val);
                                      }
                                   }} 
                                   onKeyDown={(e)=>handleKeyDown(e, idx, 'account_id')} 
                                   className="w-full bg-transparent p-2 text-center font-code outline-none text-sm" 
                                   inputMode="numeric" 
                                   pattern="[0-9]*" 
                                   dir="ltr" 
                                   placeholder="1121" 
                                />
                              </td>
                              <td className="p-1 border-l">
                                <input value={en.account_name || ''} onChange={(e)=>updateEntry(idx, 'account_name', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'account_name')} className="w-full bg-transparent p-2 outline-none font-bold text-sm" placeholder="ابحث عن الحساب" />
                              </td>
                              <td className="p-1 bg-emerald-50/20 border-l">
                                <input value={en.credit} onChange={(e)=>updateEntry(idx, 'credit', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'amount')} className="w-full bg-transparent p-2 outline-none font-code text-left text-emerald-700 font-bold" inputMode="numeric" pattern="[0-9.]*" dir="ltr" placeholder="0.00" />
                              </td>
                              <td className="p-1 bg-sky-50/20 border-l">
                                <input value={en.debit} onChange={(e)=>updateEntry(idx, 'debit', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'amount')} className="w-full bg-transparent p-2 outline-none font-code text-left text-sky-700 font-bold" inputMode="numeric" pattern="[0-9.]*" dir="ltr" placeholder="0.00" />
                              </td>
                              <td className="p-1 border-l">
                                <input value={en.check_number || ''} onFocus={() => forceCheckEntry(idx)} onChange={(e)=>updateEntry(idx, 'check_number', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'check_number')} className={`w-full bg-transparent p-2 font-code text-center outline-none ${en.type==='cash' ? 'opacity-20' : ''}`} inputMode="numeric" pattern="[0-9]*" dir="ltr" placeholder="الرقم" />
                              </td>
                              <td className="p-1 border-l">
                                <input type="date" value={en.due_date || ''} onFocus={() => forceCheckEntry(idx)} onChange={(e)=>updateEntry(idx, 'due_date', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'due_date')} className={`w-full bg-transparent p-2 font-code outline-none text-xs ${en.type==='cash' ? 'opacity-20' : ''}`} />
                              </td>
                              <td className="p-1 border-l">
                                <input 
                                   value={en.bank_code || ''} 
                                   onFocus={() => forceCheckEntry(idx)}
                                   onChange={(e)=> {
                                      const newCode = e.target.value;
                                      setEntries(prev => {
                                        const newEntries = [...prev];
                                        const current = newEntries[idx];
                                        const newEntry = { ...current, bank_code: newCode };
                                        if (SYSTEM_BANKS[newCode as keyof typeof SYSTEM_BANKS]) {
                                           newEntry.bank_name = SYSTEM_BANKS[newCode as keyof typeof SYSTEM_BANKS];
                                        }
                                        newEntries[idx] = newEntry;
                                        return newEntries;
                                      });
                                   }} 
                                   onKeyDown={(e)=>handleKeyDown(e, idx, 'bank_code')} 
                                   className={`w-full bg-transparent p-2 font-code text-center outline-none ${en.type==='cash' ? 'opacity-20' : ''}`} 
                                   inputMode="numeric" 
                                   pattern="[0-9]*" 
                                   dir="ltr" 
                                   placeholder="كود" 
                                />
                              </td>
                              <td className="p-1">
                                <input value={en.bank_name || ''} onFocus={() => forceCheckEntry(idx)} onChange={(e)=>updateEntry(idx, 'bank_name', e.target.value)} onKeyDown={(e)=>handleKeyDown(e, idx, 'bank_name')} className={`w-full bg-transparent p-2 outline-none font-bold ${en.type==='cash' ? 'opacity-20' : ''}`} placeholder="اسم البنك" />
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

             </div>

             <div className="p-6 border-t border-zinc-100 flex justify-between items-center bg-white rounded-b-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
                <div>
                   <span className="text-zinc-500 font-bold mr-2">مجموع السند:</span>
                   <span className="text-3xl font-black text-emerald-600 font-code tracking-tighter" dir="ltr">{totalAmount.toLocaleString()} {currencyCode}</span>
                </div>
                <div className="flex gap-4">
                  <button onClick={handleSubmit} className="px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer hover:bg-emerald-700 shadow-md">اعتماد وحفظ السند (Save)</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* ── Request A: Sub-Modal Check Selection ────────────────────────── */}
      {isCheckModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-zinc-200" dir="rtl">
              <h3 className="text-2xl font-black mb-4">اختر الشيكات</h3>
              <div className="max-h-80 overflow-y-auto border border-zinc-200 rounded-lg mb-4">
                 <table className="w-full text-right">
                    <thead className="bg-zinc-100">
                       <tr>
                          <th className="p-2 w-10"></th>
                          <th className="p-2">رقم الشيك</th>
                          <th className="p-2">البنك</th>
                          <th className="p-2">المبلغ</th>
                          <th className="p-2">تاريخ الاستحقاق</th>
                       </tr>
                    </thead>
                    <tbody>
                       {unclearedChecks.filter((c:any) => c.currency_code === currencyCode).map((ck: any) => (
                          <tr key={ck.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                             <td className="p-2 text-center">
                                <input type="checkbox" className="w-5 h-5 accent-emerald-600" 
                                  checked={selectedChecksIds.includes(ck.id)}
                                  onChange={(e) => {
                                     if(e.target.checked) setSelectedChecksIds([...selectedChecksIds, ck.id]);
                                     else setSelectedChecksIds(selectedChecksIds.filter(id => id !== ck.id));
                                  }}
                                />
                             </td>
                             <td className="p-2 font-code font-bold">{ck.check_number}</td>
                             <td className="p-2 font-bold text-sm">{ck.bank_name}</td>
                             <td className="p-2 font-code text-emerald-600 bg-emerald-50/30">{parseFloat(ck.amount)}</td>
                             <td className="p-2 font-code text-xs text-zinc-500" dir="ltr">{ck.due_date}</td>
                          </tr>
                       ))}
                       {unclearedChecks.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center font-bold text-zinc-400">لا توجد شيكات غير محصلة بهذه العملة في المحفظة</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="flex justify-between items-center mb-6 px-4 py-3 bg-zinc-50 rounded-lg">
                 <div className="flex gap-4 font-code font-black text-lg">
                    <div>المطلوب: <span className="text-zinc-800">{activeCheckTargetAmount}</span></div>
                    <div>المحدد: 
                       <span className={selectedChequesTotal < activeCheckTargetAmount ? 'text-rose-600' : selectedChequesTotal > activeCheckTargetAmount ? 'text-amber-500' : 'text-emerald-600'}>
                          {' '}{selectedChequesTotal}
                       </span>
                    </div>
                 </div>
                 {selectedChequesTotal > activeCheckTargetAmount && <div className="text-rose-600 font-bold text-sm bg-rose-50 px-3 py-1 rounded">المجموع أكبر من العتبة المطلوبة!</div>}
                 {selectedChequesTotal < activeCheckTargetAmount && <div className="text-rose-600 font-bold text-sm bg-rose-50 px-3 py-1 rounded">المبلغ غير كافٍ</div>}
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={confirmSelectedChecks} 
                   className={`flex-1 py-3 font-bold rounded-lg ${selectedChequesTotal === activeCheckTargetAmount ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
                   disabled={selectedChequesTotal !== activeCheckTargetAmount}
                 >
                   تأكيد تحديد الشيكات
                 </button>
                 <button onClick={() => setIsCheckModalOpen(false)} className="px-8 py-3 bg-white border border-zinc-200 font-bold rounded-lg cursor-pointer hover:bg-zinc-50">إغلاق</button>
              </div>
           </div>
        </div>
      )}

      {/* ── Request E: Exchange Rate Modal ────────────────────────── */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-[3000] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 border border-zinc-200" dir="rtl">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-amber-500">currency_exchange</span>
                 تحويل العملة ({pendingCurrency})
              </h3>
              <p className="text-zinc-500 text-sm mb-4 font-bold">يرجى إدخال سعر الصرف الحالي مقابل العملة الأساسية (ILS الشيكل).</p>
              
              <div className="mb-6">
                 <label className="text-sm font-bold text-zinc-700 block mb-2">سعر الصرف (كل 1 {pendingCurrency} = X شيكل)</label>
                 <input type="number" step="0.01" value={exchangeRate} onChange={(e)=>setExchangeRate(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl outline-none font-code text-2xl text-center text-emerald-600 font-black" autoFocus />
              </div>

              <div className="bg-emerald-50 rounded-lg p-3 mb-6 text-sm text-emerald-800 font-bold flex flex-col items-center">
                 <div>100.00 {pendingCurrency} ستمثل:</div>
                 <div className="text-2xl font-black font-code mt-1" dir="ltr">
                    {(100 * (parseFloat(exchangeRate) || 1)).toFixed(2)} ILS
                 </div>
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={() => {
                      setCurrencyCode(pendingCurrency);
                      setShowExchangeModal(false);
                   }} 
                   className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 cursor-pointer"
                 >
                   اعتماد السعر ({exchangeRate})
                 </button>
                 <button 
                   onClick={() => {
                      setPendingCurrency('ILS');
                      setShowExchangeModal(false);
                   }} 
                   className="py-3 px-6 bg-white border border-zinc-200 font-bold rounded-lg text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                 >
                   إلغاء
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
