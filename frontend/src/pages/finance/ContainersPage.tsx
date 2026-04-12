import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { useGetCustomersQuery } from '../suppliers/Customers';
import { TableSkeleton } from '../../components/Skeleton';

const containersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getContainerBalances: build.query({
      query: (customerId?: string) => `containers/balance/${customerId ? `?customer=${customerId}` : ''}`,
      providesTags: ['Containers'],
    }),
    getContainerTransactions: build.query({
      query: () => 'containers/',
      providesTags: ['Containers'],
    }),
    createContainerTransaction: build.mutation({
      query: (body) => ({
        url: 'containers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Containers'],
    }),
  }),
});

export const { useGetContainerBalancesQuery, useGetContainerTransactionsQuery, useCreateContainerTransactionMutation } = containersApi;

export default function ContainersPage() {
  const { showToast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const { data: balances, isLoading: loadingBalances } = useGetContainerBalancesQuery(selectedCustomerId);
  const { data: transactions, isLoading: loadingTx } = useGetContainerTransactionsQuery({});
  const { data: customers } = useGetCustomersQuery({}); 

  const [createTx] = useCreateContainerTransactionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    container_type: 'صندوق بلاستيك',
    direction: 'return',
    quantity: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTx(formData).unwrap();
      setIsModalOpen(false);
      setFormData({ ...formData, quantity: 1, customer: '' });
      showToast('تم التسجيل بنجاح', 'success');
    } catch (err) {
      showToast('حدث خطأ في العملية', 'error');
    }
  };

  if (loadingBalances || loadingTx) return <TableSkeleton titleWidth="260px" rows={7} columns={5} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-blue-600">box_open</span>
             إدارة أرصدة الفوارغ (الصناديق)
          </h2>
          <p className="text-zinc-500 font-bold mt-1">متابعة الصناديق البلاستيكية ومطالبات المزارعين والتجار.</p>
        </div>
        <div className="flex gap-4">
           <button 
             className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
             onClick={() => setIsModalOpen(true)}>
             <span className="material-symbols-outlined">sync_alt</span>
             تسجيل حركة فوارغ يدوية
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        
        {/* Balances Section */}
        <div className="xl:col-span-3 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-50 bg-zinc-50/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">account_balance_wallet</span>
                الأرصدة الحالية
            </h3>
            <div className="w-full md:w-64">
                <select 
                    className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                    <option value="">-- عرض كل الزبائن --</option>
                    {customers?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                  <th className="px-6 py-4">الزبون / تاجر</th>
                  <th className="px-6 py-4">النوع</th>
                  <th className="px-6 py-4 text-center">صادر</th>
                  <th className="px-6 py-4 text-center">مُرتجع</th>
                  <th className="px-6 py-4 text-center">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {(balances || []).map((b: any, index: number) => (
                  <tr key={index} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-6 py-4 font-black text-sm text-zinc-800">{b.customer_name}</td>
                    <td className="px-6 py-4 font-bold text-xs text-zinc-500">{b.container_type}</td>
                    <td className="px-6 py-4 text-center font-black font-code text-rose-600" dir="ltr">{b.out_total || 0}</td>
                    <td className="px-6 py-4 text-center font-black font-code text-emerald-600" dir="ltr">{b.return_total || 0}</td>
                    <td className="px-6 py-4 text-center">
                        <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 font-black font-code rounded-lg text-sm">
                            {b.balance}
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-50">
            <h3 className="font-black text-lg flex items-center gap-2 text-zinc-400">
                <span className="material-symbols-outlined">history</span>
                سجل الحركات الأخير
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <tbody className="divide-y divide-zinc-50">
                {(transactions || []).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-zinc-50/30">
                    <td className="px-6 py-4">
                        <div className="font-bold text-xs text-zinc-400" dir="ltr">
                            {new Date(tx.tx_date).toLocaleDateString('en-GB')}
                        </div>
                        <div className="font-bold text-sm text-zinc-800">
                            {customers?.find((c:any) => c.id === tx.customer)?.name || '...'}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${tx.direction === 'out' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {tx.direction === 'out' ? 'صرف' : 'مُرتجع'}
                        </span>
                        <div className="text-[10px] font-bold text-zinc-400 mt-1">{tx.container_type}</div>
                    </td>
                    <td className="px-6 py-4 font-black font-code text-zinc-800 text-center">
                        {tx.quantity}
                    </td>
                    <td className="px-6 py-4 text-left">
                        {tx.sale ? <span className="text-[9px] font-black bg-zinc-100 px-2 py-1 rounded-md text-zinc-400">مبيعات</span> : <span className="text-[9px] font-black bg-amber-50 px-2 py-1 rounded-md text-amber-500">يدوية</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-fade-in overflow-hidden border border-zinc-100">
               <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                   <h3 className="text-xl font-black">حركة فوارغ</h3>
                   <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600">✕</button>
               </div>
               <form onSubmit={handleSubmit} className="p-8 space-y-6">
                   <div className="space-y-2">
                       <label className="text-xs font-black text-zinc-400 uppercase">الزبون / تاجر</label>
                       <select className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none" required value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})}>
                           <option value="">-- اختر الزبون --</option>
                           {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                   </div>
                   <div className="space-y-2">
                       <label className="text-xs font-black text-zinc-400 uppercase">نوع الفارغ</label>
                       <input className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none" required value={formData.container_type} onChange={e => setFormData({...formData, container_type: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                           <label className="text-xs font-black text-zinc-400 uppercase">الاتجاه</label>
                           <select className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none" required value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value})}>
                               <option value="return">استلام (مُرتجع)</option>
                               <option value="out">صرف (تسليم)</option>
                           </select>
                       </div>
                       <div className="space-y-2">
                           <label className="text-xs font-black text-zinc-400 uppercase">الكمية</label>
                           <input type="number" min="1" className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none font-code text-center" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
                       </div>
                   </div>
                   <button type="submit" className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 active:scale-95 transition-all">اعتماد الحركة</button>
               </form>
           </div>
        </div>
      )}
    </div>
  );
}
