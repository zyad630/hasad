import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { Receipt, Plus } from 'lucide-react';
import { useGetShipmentsQuery } from '../shipments/Shipments';
import { TableSkeleton } from '../../components/Skeleton';

const expensesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query({
      query: () => 'expenses/',
      providesTags: ['Expenses'],
    }),
    createExpense: build.mutation({
      query: (body) => ({
        url: 'expenses/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Expenses'],
    }),
  }),
});

export const { useGetExpensesQuery, useCreateExpenseMutation } = expensesApi;

import { useGetCurrenciesQuery } from '../settings/Currencies';

export default function ExpensesPage() {
  const { showToast } = useToast();
  const { data: expenses, isLoading } = useGetExpensesQuery({});
  const { data: shipmentsData } = useGetShipmentsQuery({});
  const { data: currencies } = useGetCurrenciesQuery({});
  const [createExpense] = useCreateExpenseMutation();

  const shipments = shipmentsData?.results || (Array.isArray(shipmentsData) ? shipmentsData : []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    foreign_amount: '',
    exchange_rate: '1',
    currency_code: 'ILS',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    shipment: '',
    expense_type: 'misc'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const famt = parseFloat(formData.foreign_amount) || 0;
      const xr = parseFloat(formData.exchange_rate) || 1;
      await createExpense({
        currency_code: formData.currency_code,
        foreign_amount: famt,
        exchange_rate: xr,
        base_amount: parseFloat((famt * xr).toFixed(3)),
        description: formData.description,
        expense_date: formData.expense_date,
        shipment: formData.shipment || null,
      }).unwrap();
      setIsModalOpen(false);
      setFormData({ foreign_amount: '', exchange_rate: '1', currency_code: 'ILS', description: '', expense_date: new Date().toISOString().split('T')[0], shipment: '', expense_type: 'misc' });
      showToast('تم التسجيل بنجاح', 'success');
    } catch (err: any) {
      showToast(err?.data ? JSON.stringify(err.data) : 'حدث خطأ في العملية', 'error');
    }
  };

  const getExpenseLabel = (type: string) => {
    const labels: Record<string, string> = {
      transport: 'نقل ونولون',
      loading: 'تنزيل وتحميل',
      labor: 'عمالة',
      misc: 'أخرى (نثريات)'
    };
    return labels[type] || type;
  };

  if (isLoading) return <TableSkeleton titleWidth="240px" rows={7} columns={5} />;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-emerald-600">receipt_long</span>
            المصروفات والمنصرف
          </h2>
          <p className="text-zinc-500 font-bold mt-1 text-sm">سجل كامل بجميع المصروفات الإدارية والعامة للوكالة.</p>
        </div>
        <button 
          className="flex items-center gap-2 px-8 py-4 bg-emerald-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 transition-all"
          onClick={() => setIsModalOpen(true)}>
          <span className="material-symbols-outlined">add_circle</span>
          تسجيل مصروف جديد
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs font-black uppercase tracking-widest border-b border-zinc-100">
                <th className="px-6 py-5">التاريخ</th>
                <th className="px-6 py-5">نوع المصروف</th>
                <th className="px-6 py-5 text-left">المبلغ</th>
                <th className="px-6 py-5">البيان / الوصف</th>
                <th className="px-6 py-5">مرتبط بإرسالية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(expenses || []).map((exp: any) => (
                <tr key={exp.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-5 font-bold text-zinc-500" dir="ltr">
                    {new Date(exp.expense_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1.5 bg-zinc-100 text-on-surface rounded-xl text-xs font-black">
                      {exp.description || exp.category || 'مصروف'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-left">
                    <div className="font-black text-lg text-rose-700">
                      {parseFloat(exp.foreign_amount).toLocaleString()} <span className="text-xs font-bold">{exp.currency_code === 'ILS' ? '₪' : exp.currency_code}</span>
                    </div>
                    {exp.currency_code !== 'ILS' && (
                      <div className="text-[10px] text-zinc-400 font-bold">
                        = {parseFloat(exp.base_amount).toLocaleString()} ₪
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 font-bold text-on-surface">{exp.description || '-'}</td>
                  <td className="px-6 py-5">
                    {exp.shipment_id ? (
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-100 italic">#{exp.shipment_id.substring(0,8)}</span>
                    ) : (
                      <span className="text-zinc-400 text-xs font-bold italic opacity-60">مصروف عام</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[480px] rounded-[3rem] shadow-2xl animate-fade-in overflow-hidden border border-zinc-100">
            <div className="px-10 py-8 bg-zinc-50 border-b border-zinc-100 flex justify-between items-center">
               <h3 className="text-2xl font-black text-emerald-950 flex items-center gap-3">
                  <span className="material-symbols-outlined text-rose-600 text-4xl">payments</span>
                  تسجيل مصروف
               </h3>
               <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 shadow-sm transition-colors">
                  <span className="material-symbols-outlined">close</span>
               </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">المبلغ ({formData.currency_code === 'ILS' ? '₪' : formData.currency_code})</label>
                  <input type="number" step="0.001" className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 text-xl font-black text-rose-700 focus:border-rose-600 transition-all outline-none" required value={formData.foreign_amount} onChange={e => {
                    const famt = parseFloat(e.target.value) || 0;
                    const xr = parseFloat(formData.exchange_rate) || 1;
                    setFormData({...formData, foreign_amount: e.target.value});
                  }} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">التاريخ</label>
                  <input type="date" className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 font-bold text-sm focus:border-zinc-300 transition-all outline-none" required value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
                </div>
              </div>

              <div>
                 <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">العملة وسعر الصرف</label>
                 <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, currency_code: 'ILS', exchange_rate: '1'})}
                      className={`flex-1 h-12 rounded-xl text-xs font-black transition-all ${formData.currency_code === 'ILS' ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-50 text-zinc-400 border border-zinc-100'}`}
                    >شيكل (₪)</button>
                    {currencies?.map((cur: any) => (
                      <button 
                        key={cur.id}
                        type="button"
                        onClick={() => setFormData({...formData, currency_code: cur.code})}
                        className={`flex-1 h-12 rounded-xl text-xs font-black transition-all ${formData.currency_code === cur.code ? 'bg-indigo-600 text-white shadow-md' : 'bg-zinc-50 text-zinc-400 border border-zinc-100'}`}
                      >{cur.name.split(' ')[0]}</button>
                    ))}
                 </div>
                 {formData.currency_code !== 'ILS' && (
                   <div className="mt-2">
                     <label className="block text-xs font-black text-zinc-400 mb-1 uppercase">سعر الصرف (مقابل الشيكل)</label>
                     <input type="number" step="0.0001" className="w-full bg-amber-50 border-2 border-amber-200 rounded-xl h-12 px-4 font-bold text-sm outline-none" value={formData.exchange_rate} onChange={e => setFormData({...formData, exchange_rate: e.target.value})} />
                     {formData.foreign_amount && <p className="text-xs text-zinc-400 mt-1 font-bold">= {(parseFloat(formData.foreign_amount||'0') * parseFloat(formData.exchange_rate||'1')).toFixed(3)} ₪</p>}
                   </div>
                 )}
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">نوع المصروف</label>
                <div className="relative">
                   <select className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 appearance-none font-bold text-sm outline-none focus:border-emerald-600 transition-all" required value={formData.expense_type} onChange={e => setFormData({...formData, expense_type: e.target.value})}>
                     <option value="transport">نقل ونولون (سيارات)</option>
                     <option value="loading">تنزيل وتحميل للوكالة</option>
                     <option value="labor">عمالة</option>
                     <option value="misc">مصاريف أخرى (ضيافة، إلخ)</option>
                   </select>
                   <span className="material-symbols-outlined absolute left-4 top-4 text-zinc-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">تحميل على إرسالية؟ (اختياري)</label>
                <div className="relative">
                   <select className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl h-14 px-5 appearance-none font-bold text-sm outline-none focus:border-emerald-600 transition-all" value={formData.shipment} onChange={e => setFormData({...formData, shipment: e.target.value})}>
                     <option value="">بدون إضافة لإرسالية (مصروف عام)</option>
                     {shipments?.filter((s:any) => s.status === 'open').map((s: any) => (
                       <option key={s.id} value={s.id}>
                         إرسالية المزارع {s.supplier_name}
                       </option>
                     ))}
                   </select>
                   <span className="material-symbols-outlined absolute left-4 top-4 text-zinc-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">البيان / الوصف</label>
                <input className="w-full bg-zinc-100 border-none rounded-2xl h-14 px-5 font-bold text-sm placeholder:text-zinc-300 focus:ring-2 focus:ring-emerald-600 transition-all outline-none" placeholder="اكتب تفاصيل المصروف..." required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 h-16 bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/20 active:scale-95 transition-all">اعتماد المصروف</button>
                <button type="button" className="px-8 h-16 bg-zinc-100 text-zinc-500 rounded-2xl font-bold hover:bg-zinc-200 transition-colors" onClick={() => setIsModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
