import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query({
      query: () => 'items/',
      providesTags: ['Items'],
    }),
    createItem: build.mutation({
      query: (body) => ({
        url: 'items/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Items'],
    }),
  }),
});

export const { useGetItemsQuery, useCreateItemMutation } = inventoryApi;

const Inventory = () => {
  const { data: itemsData, isLoading } = useGetItemsQuery({});
  const [createItem] = useCreateItemMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', base_unit: 'kg', waste_percentage: 0
  });

  const items = itemsData?.results || (Array.isArray(itemsData) ? itemsData : []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem(formData).unwrap();
      setIsModalOpen(false);
      setFormData({name: '', base_unit: 'kg', waste_percentage: 0});
    } catch(err: any) {
      console.error('API Error:', err);
      let errorMsg = 'تأكد من إدخال اسم غير مكرر وبيانات صحيحة';
      if (err?.data) {
        if (typeof err.data === 'string') errorMsg = err.data;
        else if (err.data.name) errorMsg = `الاسم: ${err.data.name[0]}`;
        else if (err.data.waste_percentage) errorMsg = `نسبة الهالك: ${err.data.waste_percentage[0]}`;
        else if (err.data.detail) errorMsg = err.data.detail;
      }
      alert(`عفواً، فشل التسجيل: ${errorMsg}`);
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="240px" rows={7} columns={5} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header & Action Row */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <nav className="flex items-center gap-2 text-zinc-500 text-sm mb-3">
            <span>الرئيسية</span>
            <span className="material-symbols-outlined text-xs">chevron_left</span>
            <span className="text-emerald-700 font-bold">الأصناف والفوارغ</span>
          </nav>
          <h2 className="text-4xl font-extrabold text-on-surface tracking-tight">نظام إدارة الأصناف والفوارغ</h2>
          <p className="text-zinc-500 mt-2">إدارة ومراقبة حركة الأصناف ومعامِلات السلع في الحِسبة.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-secondary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-orange-900/10 h-[56px]"
          >
            <span className="material-symbols-outlined font-bold" style={{fontVariationSettings: "'FILL' 1"}}>add_box</span>
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </header>

      {/* Bento Grid: Summary Metrics (Matched with _4 style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Total Assortments */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -me-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>inventory_2</span>
            </div>
            <p className="text-zinc-500 font-medium mb-1">إجمالي الأصناف النشطة</p>
            <h3 className="text-5xl font-black text-emerald-900 tracking-tighter">{items.length}</h3>
            <p className="text-emerald-600 text-sm mt-2 flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-xs">verified</span>
              <span>دليل معتمد</span>
            </p>
          </div>
        </div>

        {/* Categories / Types */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -me-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined">category</span>
              </div>
              <p className="text-zinc-500 font-medium mb-1">متوسط نسبة الهالك لمعظم الأصناف</p>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">
                {items.length ? (items.reduce((acc:any, curr:any) => acc + parseFloat(curr.waste_percentage || 0), 0) / items.length).toFixed(1) : 0}%
              </h3>
            </div>
        </div>

        {/* Fawarigh (Disabled/Future but displayed beautifully) */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/50 rounded-bl-full -me-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-orange-100 text-secondary rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined">shopping_basket</span>
              </div>
              <p className="text-zinc-500 font-medium mb-1">رصيد الفوارغ الخشبية والبلاستيكية</p>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">--</h3>
              <div className="flex gap-4 mt-4">
                <div className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-bold border border-slate-200">بلاستيك: --</div>
                <div className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-bold border border-slate-200">خشب: --</div>
              </div>
            </div>
        </div>
      </div>

      {/* Primary Table Section */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_8px_48px_rgba(0,0,0,0.03)] overflow-hidden border border-zinc-100">
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100/50">
          <div>
            <h4 className="text-xl font-bold text-slate-900">سجل أصناف السلع</h4>
            <p className="text-sm text-slate-500 mt-1">السلع المُسجلة في النظام والتي يمكن استلام إرساليات بها</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input 
                className="w-full pe-12 ps-4 py-3 bg-zinc-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-700 text-sm transition-all" 
                placeholder="البحث عن صنف معين..." 
                type="text"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50 text-slate-500 text-sm tracking-wider border-b border-zinc-100">
                <th className="px-8 py-5 font-bold">اسم الصنف</th>
                <th className="px-6 py-5 font-bold">وحدة القياس</th>
                <th className="px-6 py-5 font-bold">الهالك المتوقع (%)</th>
                <th className="px-6 py-5 font-bold">معاملات التحويل</th>
                <th className="px-6 py-5 font-bold text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any, idx: number) => {
                const colorClasses = [
                  "bg-emerald-100 text-emerald-800",
                  "bg-orange-100 text-orange-800",
                  "bg-blue-100 text-blue-800",
                  "bg-rose-100 text-rose-800"
                ][idx % 4];

                return (
                  <tr key={item.id} className="group hover:bg-emerald-50/30 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${colorClasses}`}>
                          {item.name.charAt(0)}
                        </div>
                        <div className="font-bold text-slate-900 text-base">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6 font-bold text-slate-700">
                       <span className="bg-zinc-100 px-3 py-1 rounded-md text-xs border border-zinc-200">
                         {item.base_unit === 'kg' ? 'كيلوجرام' : item.base_unit === 'box' ? 'صندوق/قفص' : item.base_unit === 'sack' ? 'شوال' : 'ربطة'}
                       </span>
                    </td>
                    <td className="px-6 py-6 text-sm font-bold">
                      <span className={parseFloat(item.waste_percentage) > 5 ? 'text-rose-600' : 'text-emerald-600'}>
                        {item.waste_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-6 font-code text-xs text-slate-500">
                       {item.conversions?.length > 0 
                        ? item.conversions.map((c:any) => `1 ${c.from_unit} = ${c.factor} ${c.to_unit}`).join(' | ') 
                        : <span className="text-zinc-300">بدون تحويلات إضافية</span>
                       }
                    </td>
                    <td className="px-6 py-6 text-center">
                       {item.is_active ? (
                         <span className="bg-emerald-100 text-emerald-900 px-4 py-1.5 rounded-full text-xs font-black">فعال</span>
                       ) : (
                         <span className="bg-rose-100 text-rose-900 px-4 py-1.5 rounded-full text-xs font-black">موقوف</span>
                       )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                 <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                     <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">category</span>
                     لا توجد أصناف في الدليل
                   </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-[0_16px_60px_rgba(0,0,0,0.1)] border border-white flex flex-col animate-fade-in overflow-hidden">
            <div className="px-8 py-6 bg-emerald-900/5 text-emerald-900 border-b border-emerald-900/10 flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>add_box</span>
                إضافة صنف للكتالوج
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-emerald-900/10 flex flex-col items-center justify-center transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">اسم الصنف</label>
                <input 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-2xl px-5 h-[56px] focus:ring-2 focus:ring-primary text-lg transition-all" 
                  placeholder="مثال: خيار بلدي فاخر" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">وحدة القياس المعتمدة</label>
                  <div className="relative">
                    <select 
                      value={formData.base_unit} 
                      onChange={e => setFormData({...formData, base_unit: e.target.value})}
                      className="w-full bg-surface-container-low border-none appearance-none rounded-2xl px-5 h-[56px] focus:ring-2 focus:ring-primary text-base font-bold transition-all" 
                    >
                      <option value="kg">كيلو جرام</option>
                      <option value="box">صندوق / قفص</option>
                      <option value="sack">شوال</option>
                      <option value="bunch">ربطة</option>
                    </select>
                    <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
                       <span className="material-symbols-outlined">expand_more</span>
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2 text-zinc-500">نسبة الهالك (العجز) المتوقع</label>
                  <div className="relative">
                     <input 
                       type="number" step="0.01" 
                       value={formData.waste_percentage} 
                       onChange={e => setFormData({...formData, waste_percentage: parseFloat(e.target.value)})} 
                       className="w-full bg-surface-container-low border-none rounded-2xl px-5 h-[56px] focus:ring-2 focus:ring-primary text-center font-bold text-xl transition-all" 
                     />
                     <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400 text-xs font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 flex gap-4 mt-8">
                <button type="submit" className="flex-1 h-[60px] bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-lg tracking-wide">
                  اعتماد الصنف الجديد
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Inventory;
