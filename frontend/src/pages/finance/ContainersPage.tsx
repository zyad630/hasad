import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';
import { SmartSearch } from '../../components/ui/SmartSearch';

const containersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getContainerBalances: build.query({
      query: (params: any) => ({
        url: 'containers/balances/',
        params
      }),
      providesTags: ['Containers', 'Shipments'],
    }),
    createContainerTransaction: build.mutation({
      query: (body) => ({
        url: 'containers/transactions/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Containers', 'Shipments'],
    }),
    searchParties: build.query({
      query: (q) => `reports/search-parties/?q=${encodeURIComponent(q)}`,
    }),
  }),
  overrideExisting: true,
});

export const { 
  useGetContainerBalancesQuery, 
  useCreateContainerTransactionMutation,
  useSearchPartiesQuery 
} = containersApi;

export default function ContainersPage() {
  const { showToast } = useToast();
  const [filterParty, setFilterParty] = useState<any>(null);
  
  const { data: balances, isLoading: loadingBalances } = useGetContainerBalancesQuery({
    party_id: filterParty?.id,
    party_type: filterParty?.type
  });
  
  const [createTx, { isLoading: isSaving }] = useCreateContainerTransactionMutation();
  const [triggerSearch] = containersApi.useLazySearchPartiesQuery();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [formData, setFormData] = useState({
    container_type: 'صندوق بلاستيك',
    direction: 'return',
    quantity: 1,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) {
      showToast('يرجى اختيار الحساب المطلوب أولاً', 'warning');
      return;
    }
    try {
      await createTx({
        ...formData,
        party_id: selectedParty.id,
        party_type: selectedParty.type === 'supplier' ? 'farmer' : (selectedParty.type === 'employee' ? 'employee' : 'customer')
      }).unwrap();
      setIsModalOpen(false);
      setFormData({ ...formData, quantity: 1 });
      setSelectedParty(null);
      showToast('تم تسجيل الحركة بنجاح', 'success');
    } catch (err: any) {
      showToast(err?.data?.error || 'حدث خطأ في العملية', 'error');
    }
  };

  if (loadingBalances) return <TableSkeleton titleWidth="260px" rows={7} columns={5} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-blue-600">inventory_2</span>
             إدارة أرصدة الفوارغ (الصناديق)
          </h2>
          <p className="text-zinc-500 font-bold mt-1">متابعة الصناديق والعهد لدى المزارعين، التجار، والموظفين.</p>
        </div>
        <div className="flex gap-4">
           <button 
             className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
             onClick={() => setIsModalOpen(true)}>
             <span className="material-symbols-outlined">sync_alt</span>
             تسجيل حركة يدوية
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Balances Section */}
        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-zinc-50 bg-zinc-50/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <h3 className="font-black text-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">account_balance_wallet</span>
                الأرصدة الحالية
            </h3>
            <div className="w-full md:w-96">
                <SmartSearch 
                   placeholder="ابحث عن مزارع أو تاجر لتصفية النتائج..."
                   value={filterParty?.name || ''}
                   onSearch={async (q) => {
                      const res = await triggerSearch(q).unwrap();
                      return res;
                   }}
                   onSelect={(p) => setFilterParty(p)}
                   renderItem={(item) => (
                      <div className="flex justify-between items-center w-full">
                         <span className="font-bold">{item.name}</span>
                         <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{item.type_label}</span>
                      </div>
                   )}
                />
                {filterParty && (
                  <button onClick={() => setFilterParty(null)} className="mt-2 text-[10px] font-black text-rose-500 flex items-center gap-1 hover:underline">
                    <span className="material-symbols-outlined text-xs">close</span>
                    إلغاء التصفية وعرض الكل
                  </button>
                )}
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b border-zinc-100">
                  <th className="px-8 py-5">الطرف / الحساب</th>
                  <th className="px-8 py-5">النوع</th>
                  <th className="px-8 py-5 text-center">الرصيد المتبقي (العهدة)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {(balances || []).map((b: any, index: number) => (
                  <tr key={`${b.party_type}-${b.party_id}`} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-8 py-5 font-black text-sm text-zinc-800">{b.name}</td>
                    <td className="px-8 py-5">
                       <span className="inline-block px-3 py-1 bg-zinc-100 text-zinc-500 font-black rounded-lg text-[10px] uppercase">
                          {b.party_type === 'farmer' ? 'مزارع' : (b.party_type === 'employee' ? 'موظف' : 'زبون')}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                        <span className={`inline-block px-6 py-2 rounded-xl font-black font-code text-lg ${b.balance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {b.balance} {b.balance > 0 ? 'صادر' : 'له'}
                        </span>
                    </td>
                  </tr>
                ))}
                {balances?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center text-zinc-400 font-bold">
                       لا توجد أرصدة فوارغ مسجلة لهذا الحساب.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-[500px] rounded-[3rem] shadow-2xl animate-fade-in overflow-hidden border border-zinc-100">
               <div className="p-10 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                   <h3 className="text-2xl font-black text-blue-900 flex items-center gap-3">
                      <span className="material-symbols-outlined text-rose-600 text-4xl">move_up</span>
                      حركة فوارغ يدوية
                   </h3>
                   <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 shadow-sm transition-all">✕</button>
               </div>
               <form onSubmit={handleSubmit} className="p-10 space-y-6">
                   <div className="space-y-3">
                       <label className="text-xs font-black text-zinc-400 uppercase">اسم الشخص (زبون، مزارع، موظف)</label>
                       <SmartSearch 
                          placeholder="اكتب الاسم هنا..."
                          value={selectedParty?.name || ''}
                          onSearch={async (q) => {
                             const res = await triggerSearch(q).unwrap();
                             return res;
                          }}
                          onSelect={(p) => setSelectedParty(p)}
                          renderItem={(item) => (
                             <div className="flex justify-between items-center w-full">
                                <span className="font-bold">{item.name}</span>
                                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{item.type_label}</span>
                             </div>
                          )}
                       />
                       {selectedParty && (
                         <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-black text-blue-800">الحساب المختار: {selectedParty.name}</span>
                            <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-lg font-black uppercase">{selectedParty.type_label}</span>
                         </div>
                       )}
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-3">
                           <label className="text-xs font-black text-zinc-400 uppercase">نوع الحركة</label>
                           <select className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 font-black text-sm outline-none focus:border-blue-500 transition-all appearance-none" required value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value})}>
                               <option value="return">استلام (مُرتجع للوكالة)</option>
                               <option value="out">صرف (تسليم للشخص)</option>
                           </select>
                       </div>
                       <div className="space-y-3">
                           <label className="text-xs font-black text-zinc-400 uppercase">الكمية</label>
                           <input type="number" min="1" className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 font-black text-2xl text-rose-700 text-center outline-none focus:border-rose-500 transition-all" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
                       </div>
                   </div>

                   <div className="space-y-3">
                       <label className="text-xs font-black text-zinc-400 uppercase">ملاحظات إضافية</label>
                       <input className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 font-bold text-sm outline-none focus:border-zinc-300" placeholder="اكتب بياناً مختصراً للحركة..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                   </div>

                   <button type="submit" disabled={isSaving} className="w-full h-16 bg-blue-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50">
                      {isSaving ? '⏳ جاري الاعتماد...' : 'اعتماد وترحيل الحركة'}
                   </button>
               </form>
           </div>
        </div>
      )}
    </div>
  );
}

