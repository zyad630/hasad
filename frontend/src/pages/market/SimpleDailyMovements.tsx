import { useEffect, useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { useGetSuppliersQuery } from '../suppliers/Suppliers';
import { useGetCustomersQuery } from '../suppliers/Customers';
import SmartSearch from '../../components/ui/SmartSearch';

const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query({ query: () => 'inventory/items/' }),
  }),
});
const { useGetItemsQuery } = inventoryApi;

const transcriptionApi = api.injectEndpoints({
  endpoints: (build) => ({
    createFastTranscription: build.mutation({
      query: (body) => ({
        url: 'market/fast-transcription/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Sales', 'Shipments', 'Cash', 'Suppliers', 'Customers'],
    }),
  }),
});
const { useCreateFastTranscriptionMutation } = transcriptionApi;

const normalizeArabicNumerals = (str: string) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
            .replace(/[۰-۹]/g, (d) => "۰۱۲۳٤٥٦۷۸۹".indexOf(d).toString());
};

export default function SimpleDailyMovements() {
  const { showToast } = useToast();
  const today = new Date();
  
  const [triggerSearchParties] = api.useLazySearchPartiesQuery();
  const { data: itemsData } = useGetItemsQuery({});
  const [createTranscription, { isLoading }] = useCreateFastTranscriptionMutation();

  const itemsList = itemsData?.results || itemsData || [];

  const [newRow, setNewRow] = useState<any>({
    supplier: '', supplier_name: '', item_name: '', count: '', net_weight: '',
    supplier_commission: 10, buyer: '', buyer_name: '', buyer_commission: 2, 
    price: ''
  });

  const [historyList, setHistoryList] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('simple_daily_movements_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistoryList(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('simple_daily_movements_history', JSON.stringify(historyList.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [historyList]);

  const handleInputChange = (field: string, value: string) => {
    setNewRow((prev: any) => ({
      ...prev,
      [field]: normalizeArabicNumerals(value)
    }));
  };

  const handleSave = async () => {
    if (!newRow.supplier || !newRow.buyer || !newRow.item_name || !newRow.net_weight || !newRow.price) {
       showToast('يرجى تعبئة الحقول الأساسية: المزارع، المشتري، الصنف، الوزن، والسعر', 'warning');
       return;
    }

    try {
      await createTranscription(newRow).unwrap();
      
      const supplierName = newRow.supplier_name || 'غير معروف';
      const buyerName = newRow.buyer_name || 'غير معروف';
      setHistoryList([{ ...newRow, supplierName, buyerName, id: Date.now() }, ...historyList]);
      
      showToast('تم ترحيل وبناء الفواتير والقيود المحاسبية بنجاح', 'success');

      setNewRow({
        ...newRow,
        item_name: '', count: '', net_weight: '', price: '', buyer: ''
      });
      setTimeout(() => {
        const input = document.getElementById('nr-supplier');
        if (input) input.focus();
      }, 100);
    } catch (err: any) {
       showToast(err?.data?.detail || 'حدث خطأ أثناء الترحيل', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const flow = [
        'supplier', 'item_name', 'count', 'net_weight', 'sup_comm', 
        'buyer', 'buy_comm', 'price'
      ];
      const currentIndex = flow.indexOf(field);
      if (currentIndex > -1 && currentIndex < flow.length - 1) {
        const nextField = flow[currentIndex + 1];
        setTimeout(() => {
            const nextEl = document.getElementById(`nr-${nextField}`);
            if (nextEl) nextEl.focus();
        }, 10);
      } else if (currentIndex === flow.length - 1) {
        handleSave();
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 font-cairo" dir="rtl">
      <header className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-3xl">edit_document</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-800">تفريغ الحركات (تفريغ الميدان)</h2>
            <p className="text-zinc-500 font-bold text-sm">سجل مبيعاتك ومشترياتك في خطوة واحدة وبسرعة فائقة.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-zinc-50 px-6 py-2 rounded-xl border border-zinc-100 text-center">
             <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">تاريخ اليوم</div>
             <div className="text-md font-black text-primary">
                {today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, ' / ')}
             </div>
          </div>
          <div className="bg-emerald-50 px-6 py-2 rounded-xl border border-emerald-100 text-center">
             <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">الإدخالات</div>
             <div className="text-md font-black text-emerald-700">{historyList.length}</div>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-zinc-200/50 border border-zinc-200 overflow-visible">
         <div className="overflow-x-auto pb-60">
            <table className="w-full text-right border-collapse min-w-[1200px]">
               <thead>
                  <tr className="bg-zinc-800 text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                     <th className="px-6 py-5 w-64 border-l border-zinc-700">المزارع (البائع)</th>
                     <th className="px-6 py-5 w-44">الصنف</th>
                     <th className="px-6 py-5 w-32 text-center">العدد</th>
                     <th className="px-6 py-5 w-32 text-center">الوزن الصافي</th>
                     <th className="px-6 py-5 w-32 text-center text-rose-400">عمولة مزارع %</th>
                     <th className="px-6 py-5 w-64 border-r border-zinc-700 bg-zinc-700/30">المشتري (الزبون)</th>
                     <th className="px-6 py-5 w-32 text-center text-indigo-400">عمولة مشتري %</th>
                     <th className="px-6 py-5 w-40 text-center bg-emerald-900/40 text-emerald-400">سعر الوحدة</th>
                     <th className="px-6 py-5 w-24 text-center">تثبيت</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-zinc-100">
                  <tr className="bg-primary/5 hover:bg-primary/10 transition-colors">
                     <td className="px-4 py-4 border-l border-zinc-100 relative overflow-visible">
                        <SmartSearch 
                           id="nr-supplier"
                           placeholder="ابحث عن مزارع..."
                           onSearch={async (q) => {
                               const res = await triggerSearchParties(q).unwrap();
                               return res;
                           }}
                           renderItem={(p: any) => (
                             <div className="flex justify-between items-center w-full">
                                <span className="font-bold">{p.name}</span>
                                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.type_label}</span>
                             </div>
                           )}
                           onSelect={(p: any) => {
                               setNewRow(prev => ({...prev, supplier: p.id, supplier_name: p.name}));
                               setTimeout(() => document.getElementById('nr-item_name')?.focus(), 10);
                           }}
                           onEnterEmpty={() => {
                                const el = document.getElementById('nr-item_name');
                                if (el) el.focus();
                           }}
                           value={newRow.supplier_name}
                        />
                     </td>
                     <td className="px-4 py-4 relative overflow-visible">
                        <SmartSearch 
                           id="nr-item_name"
                           placeholder="اسم الصنف..."
                           onSearch={async () => itemsList}
                           getLabel={(item: any) => item.name}
                           onSelect={(item: any) => {
                              handleInputChange('item_name', item.name);
                              setTimeout(() => document.getElementById('nr-count')?.focus(), 10);
                           }}
                           onEnterEmpty={() => {
                               const el = document.getElementById('nr-count');
                               if (el) el.focus();
                           }}
                           value={newRow.item_name}
                        />
                     </td>
                     <td className="px-4 py-4">
                        <input id="nr-count" onKeyDown={e => handleKeyDown(e, 'count')} className="w-full bg-white border border-zinc-200 rounded-xl p-3 font-black text-center text-lg shadow-inner outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="0" value={newRow.count} onChange={e => handleInputChange('count', e.target.value)} />
                     </td>
                     <td className="px-4 py-4">
                        <input id="nr-net_weight" onKeyDown={e => handleKeyDown(e, 'net_weight')} className="w-full bg-white border border-zinc-200 rounded-xl p-3 font-black text-center text-lg shadow-inner outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="0.00" value={newRow.net_weight} onChange={e => handleInputChange('net_weight', e.target.value)} />
                     </td>
                     <td className="px-4 py-4 text-center">
                        <input id="nr-sup_comm" onKeyDown={e => handleKeyDown(e, 'sup_comm')} className="w-24 bg-rose-50 border border-rose-100 rounded-xl p-3 font-black text-center text-lg text-rose-600 outline-none focus:ring-2 focus:ring-rose-500 transition-all mx-auto" value={newRow.supplier_commission} onChange={e => handleInputChange('supplier_commission', e.target.value)} />
                     </td>
                     <td className="px-4 py-4 border-r border-zinc-100 bg-zinc-50/50 relative overflow-visible">
                        <SmartSearch 
                           id="nr-buyer"
                           placeholder="ابحث عن مشتري..."
                           onSearch={async (q) => {
                               const res = await triggerSearchParties(q).unwrap();
                               return res;
                           }}
                           renderItem={(p: any) => (
                             <div className="flex justify-between items-center w-full">
                                <span className="font-bold">{p.name}</span>
                                <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{p.type_label}</span>
                             </div>
                           )}
                           onSelect={(p: any) => {
                               setNewRow(prev => ({...prev, buyer: p.id, buyer_name: p.name}));
                               setTimeout(() => document.getElementById('nr-buy_comm')?.focus(), 10);
                           }}
                           onEnterEmpty={() => {
                                const el = document.getElementById('nr-buy_comm');
                                if (el) el.focus();
                           }}
                           value={newRow.buyer_name}
                        />
                     </td>
                     <td className="px-4 py-4 text-center">
                        <input id="nr-buy_comm" onKeyDown={e => handleKeyDown(e, 'buy_comm')} className="w-24 bg-indigo-50 border border-indigo-100 rounded-xl p-3 font-black text-center text-lg text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all mx-auto" value={newRow.buyer_commission} onChange={e => handleInputChange('buyer_commission', e.target.value)} />
                     </td>
                     <td className="px-4 py-4 text-center">
                        <input id="nr-price" onKeyDown={e => handleKeyDown(e, 'price')} className="w-32 bg-emerald-50 border border-emerald-100 rounded-xl p-3 font-black text-center text-xl text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all mx-auto" placeholder="0.00" value={newRow.price} onChange={e => handleInputChange('price', e.target.value)} />
                     </td>
                     <td className="px-4 py-4 text-center">
                        <button disabled={isLoading} onClick={handleSave} className="w-14 h-14 bg-zinc-800 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-black hover:scale-105 active:scale-95 transition-all mx-auto disabled:opacity-50">
                           {isLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-3xl">done_all</span>}
                        </button>
                     </td>
                  </tr>

                  {/* Generated History */}
                  {historyList.map((m: any, i) => (
                    <tr key={i} className="hover:bg-zinc-50 transition-colors animate-slide-down bg-white h-20">
                       <td className="px-6 py-4 font-bold text-zinc-900 border-l border-zinc-100">{m.supplierName}</td>
                       <td className="px-6 py-4 font-bold text-zinc-500">{m.item_name}</td>
                       <td className="px-6 py-4 font-black text-center text-zinc-800 text-lg">{m.count}</td>
                       <td className="px-6 py-4 font-black text-center text-zinc-800 text-lg">{m.net_weight} <span className="text-[10px] text-zinc-400">كجم</span></td>
                       <td className="px-6 py-4 font-black text-center text-rose-600 text-lg">%{m.supplier_commission}</td>
                       <td className="px-6 py-4 border-r border-zinc-100 font-bold text-indigo-900 bg-zinc-50/20">{m.buyerName}</td>
                       <td className="px-6 py-4 font-black text-center text-indigo-600 text-lg">%{m.buyer_commission}</td>
                       <td className="px-6 py-4 bg-emerald-50/20 font-black text-emerald-800 text-center text-xl">
                          {(parseFloat(m.price) || 0).toFixed(2)} <span className="text-xs text-zinc-400">₪</span>
                          <div className="text-[9px] text-zinc-400 mt-0.5">إجمالي: {((parseFloat(m.price)||0)*(parseFloat(m.net_weight)||0)).toFixed(0)} ₪</div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                             <span className="material-symbols-outlined text-xl">check</span>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
