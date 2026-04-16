import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { useToast } from '../../components/ui/Toast';
import { SmartSearch } from '../../components/ui/SmartSearch';

const financeApi = api.injectEndpoints({
  endpoints: (build) => ({
    createJournalVoucher: build.mutation({
      query: (data) => ({
        url: `journal-vouchers/`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Finance', 'Cash', 'Suppliers', 'Customers'],
    }),
  }),
});

export const { useCreateJournalVoucherMutation } = financeApi;

export default function JournalVoucherPage() {
  const { showToast } = useToast();
  
  const [drSelected, setDrSelected] = useState<any>(null);
  const [crSelected, setCrSelected] = useState<any>(null);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [triggerSearchParties] = api.useLazySearchPartiesQuery();
  const [createVoucher, { isLoading }] = useCreateJournalVoucherMutation();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drSelected || !crSelected || !amount || parseFloat(amount) <= 0) {
      showToast('يرجى تعبئة الحقول المطلوبة واختيار الحسابات', 'error');
      return;
    }

    try {
      await createVoucher({
        amount: parseFloat(amount),
        description: description,
        currency_code: 'ILS',
        exchange_rate: 1,
        dr_account_type: drSelected.type,
        dr_account_id: drSelected.id,
        dr_account_name: drSelected.name,
        cr_account_type: crSelected.type,
        cr_account_id: crSelected.id,
        cr_account_name: crSelected.name,
      }).unwrap();
      showToast('تم ترحيل قيد اليومية بنجاح', 'success');
      
      setAmount('');
      setDescription('');
      setDrSelected(null);
      setCrSelected(null);
    } catch (err: any) {
      showToast(err?.data?.error || 'حدث خطأ أثناء حفظ القيد', 'error');
    }
  };

  const renderSearchBox = (
    label: string,
    selected: any, 
    setSelected: (s: any) => void,
    typeLabelColor: string
  ) => (
    <div className="relative">
      <label className="block text-sm font-black text-zinc-500 mb-2">{label}</label>
      <SmartSearch 
        id={`jv-${label}`}
        placeholder="ابحث بالاسم أو الرقم..."
        onSearch={async (q) => {
           const res = await triggerSearchParties(q).unwrap();
           return res;
        }}
        renderItem={(item: any) => (
          <div className="flex items-center justify-between w-full">
            <span className="font-bold">{item.name}</span>
            <span className={`text-[10px] font-black ${typeLabelColor} px-2 py-0.5 rounded-full`}>{item.type_label}</span>
          </div>
        )}
        onSelect={(item) => setSelected(item)}
        value={selected ? selected.name : ''}
        style={{ width: '100%' }}
      />
      {selected && (
        <div className="mt-2 text-xs font-bold text-zinc-400 flex items-center gap-1">
           <span className="material-symbols-outlined text-xs">info</span>
           نوع الحساب: {selected.type_label}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      <header>
        <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-purple-600">account_balance</span>
          مستند القيد (Journal Voucher)
        </h2>
        <p className="text-zinc-500 font-bold mt-1">إنشاء قيد محاسبي حر بين أي حسابين</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* DEBIT */}
          <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-3xl">
            <h3 className="text-lg font-black text-rose-700 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">add_circle</span> من حساب (المدين - عليه)
            </h3>
            {renderSearchBox('اختر الحساب المدين', drSelected, setDrSelected, 'bg-rose-100 text-rose-700')}
          </div>

          {/* CREDIT */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl">
            <h3 className="text-lg font-black text-emerald-700 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">remove_circle</span> إلى حساب (الدائن - له)
            </h3>
            {renderSearchBox('اختر الحساب الدائن', crSelected, setCrSelected, 'bg-emerald-100 text-emerald-700')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-black text-zinc-500 mb-2">المبلغ الأساسي (شيكل)</label>
            <input 
              type="number" step="0.01" min="0" required
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-purple-600 outline-none font-black text-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-black text-zinc-500 mb-2">البيان (شرح القيد)</label>
            <input 
              type="text" required
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-purple-600 outline-none font-bold text-sm"
              placeholder="وصف سبب القيد..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-zinc-100">
          <button 
            type="submit" 
            disabled={isLoading}
            className="bg-purple-600 text-white flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">{isLoading ? 'hourglass_empty' : 'save'}</span>
            حفظ وترحيل القيد
          </button>
        </div>
      </form>
    </div>
  );
}
