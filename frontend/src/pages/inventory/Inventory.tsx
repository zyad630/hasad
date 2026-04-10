import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

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
    updateItem: build.mutation({
      query: ({ id, ...body }) => ({
        url: `items/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Items'],
    }),
    getUnits: build.query({
      query: () => 'global-units/',
      providesTags: ['GlobalUnits'] as any,
    }),
  }),
});

export const { useGetItemsQuery, useCreateItemMutation, useUpdateItemMutation, useGetUnitsQuery } = inventoryApi;

const Inventory = () => {
  const { showToast } = useToast();
  const { data: itemsData, isLoading } = useGetItemsQuery({});
  const { data: unitsData } = useGetUnitsQuery({});
  const [createItem] = useCreateItemMutation();
  const [updateItem] = useUpdateItemMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', base_unit: 'kg', waste_percentage: 0
  });

  const items = itemsData?.results || (Array.isArray(itemsData) ? itemsData : []);
  const units = unitsData?.results || (Array.isArray(unitsData) ? unitsData : []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateItem({ id: editingId, ...formData }).unwrap();
      } else {
        await createItem(formData).unwrap();
      }
      closeModal();
    } catch(err: any) {
      showToast('خطأ في العملية: تأكد من البيانات', 'error');
    }
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      base_unit: item.base_unit,
      waste_percentage: parseFloat(item.waste_percentage) || 0
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', base_unit: 'kg', waste_percentage: 0 });
  };

  if (isLoading) return <VegetableLoader text="جاري تحميل قائمة الأصناف..." fullScreen />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">warehouse</span>
             المستودع وإدارة الأصناف
          </h2>
          <p className="text-zinc-500 mt-2 font-bold opacity-70">إدارة دليل السلع، وحدات القياس المخصصة، ونسب الهالك.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-8 py-4 bg-emerald-700 text-white rounded-2xl font-black shadow-xl shadow-emerald-900/20 hover:scale-105 active:scale-95 transition-all h-[56px]"
        >
          <span className="material-symbols-outlined">add_box</span>
          <span>إضافة صنف جديد</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100 flex flex-col justify-center">
          <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">إجمالي الأصناف</p>
          <h3 className="text-4xl font-black text-on-surface">{items.length}</h3>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100 border-r-4 border-r-indigo-500 flex flex-col justify-center">
           <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">وحدات القياس</p>
           <div className="flex gap-2 mt-2">
              <span className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[10px] font-black">KG</span>
              <span className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[10px] font-black">BOX</span>
              <span className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[10px] font-black">SACK</span>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100 border-r-4 border-r-amber-500 flex flex-col justify-center">
           <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">الهالك</p>
           <div className="text-amber-600 font-black text-xs">يتم احتسابه تلقائياً في التصفية</div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50/30 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                <th className="px-8 py-5">اسم الصنف</th>
                <th className="px-6 py-5">وحدة القياس</th>
                <th className="px-6 py-5">نسبة الهالك</th>
                <th className="px-6 py-5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-zinc-50/50 group transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl">
                        {item.name.charAt(0)}
                      </div>
                      <div className="font-bold text-on-surface text-lg">{item.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-6 font-bold text-zinc-500">
                     <span className="px-3 py-1 bg-zinc-100 rounded-lg text-[10px] font-black uppercase">
                       {units.find((u: any) => u.id === item.base_unit || u.name === item.base_unit)?.name || (item.base_unit === 'kg' ? 'كيلو جرام' : item.base_unit)}
                     </span>
                  </td>
                  <td className="px-6 py-6">
                     <span className={`font-black ${parseFloat(item.waste_percentage) > 5 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {item.waste_percentage}%
                     </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <button 
                      onClick={() => openEdit(item)}
                      className="w-10 h-10 bg-white border border-zinc-200 rounded-xl text-zinc-400 hover:text-emerald-600 transition-all flex items-center justify-center mx-auto shadow-sm">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[200] flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-fade-in border-r border-zinc-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-emerald-600">{editingId ? 'edit_note' : 'add_box'}</span>
                {editingId ? 'تعديل صنف' : 'إضافة صنف جديد'}
              </h3>
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 shadow-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 p-8 space-y-6 overflow-y-auto w-full">
              <form id="itemForm" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">اسم السلعة / الصنف</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold focus:border-emerald-600 outline-none" placeholder="مثل: طماطم بلدي..." />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">وحدة القياس الافتراضية</label>
                  <select value={formData.base_unit} onChange={e => setFormData({...formData, base_unit: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold outline-none focus:border-emerald-600">
                    <option value="kg">كيلو جرام (افتراضي)</option>
                    {units.map((u: any) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase tracking-tighter">نسبة الهالك المتوقعة (%)</label>
                  <input type="number" step="0.1" value={formData.waste_percentage} onChange={e => setFormData({...formData, waste_percentage: parseFloat(e.target.value)})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-black text-center focus:border-emerald-600 outline-none" />
                </div>
              </form>
            </div>
            <div className="p-8 border-t border-zinc-100 flex gap-4 bg-zinc-50/20">
              <button form="itemForm" type="submit" className="flex-1 h-14 bg-emerald-700 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] transition-all">
                {editingId ? 'تعديل البيانات' : 'إضافة للكتالوج'}
              </button>
              <button onClick={closeModal} className="px-8 h-14 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-2xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Inventory;
