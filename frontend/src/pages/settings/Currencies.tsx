import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

const currencyApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCurrencies: build.query({
      query: () => 'currencies/',
      providesTags: ['Currencies'],
    }),
    createCurrency: build.mutation({
      query: (body) => ({
        url: 'currencies/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Currencies'],
    }),
    deleteCurrency: build.mutation({
      query: (id) => ({
        url: `currencies/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Currencies'],
    }),
  }),
});

export const { useGetCurrenciesQuery, useCreateCurrencyMutation, useDeleteCurrencyMutation } = currencyApi;

const CurrenciesPage = () => {
  const { showToast } = useToast();
  const { data: currencies, isLoading } = useGetCurrenciesQuery({});
  const [createCurrency] = useCreateCurrencyMutation();
  const [deleteCurrency] = useDeleteCurrencyMutation();

  const [formData, setFormData] = useState({ code: '', name: '', symbol: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCurrency(formData).unwrap();
      setFormData({ code: '', name: '', symbol: '' });
    } catch (err) {
      showToast('خطأ في إضافة العملة', 'error');
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="200px" rows={5} columns={4} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-on-surface">إدارة العملات</h2>
          <p className="text-on-surface-variant mt-2">إضافة وتفعيل العملات المستخدمة في عمليات البيع والتحصيل.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Add Currency Form */}
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col gap-6 h-fit md:sticky md:top-24">
          <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-900 border-b pb-4 border-zinc-50">
            <span className="material-symbols-outlined">add_circle</span>
            إضافة عملة جديدة
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2">كود العملة (ISO)</label>
              <input 
                required 
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-600 outline-none h-[54px] font-code" 
                placeholder="مثلاً: USD, JOD" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2">اسم العملة بالكامل</label>
              <input 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-600 outline-none h-[54px]" 
                placeholder="مثلاً: دولار أمريكي" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2">الرمز (Symbol)</label>
              <input 
                required 
                value={formData.symbol}
                onChange={e => setFormData({...formData, symbol: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-600 outline-none h-[54px] text-center font-bold text-lg" 
                placeholder="$" 
              />
            </div>
            <button className="w-full bg-emerald-700 text-white rounded-xl h-[56px] font-bold shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 active:scale-95 transition-all mt-4">
               تفعيل العملة
            </button>
          </form>
        </div>

        {/* List of Currencies */}
        <div className="md:col-span-2 space-y-4">
          {/* Base Currency Card */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold mb-2">
                <span className="material-symbols-outlined text-[1rem]">star</span>
                العملة الأساسية (للميزانية)
              </div>
              <h3 className="text-3xl font-black mb-1">الشيكل الإسرائيلي</h3>
              <p className="text-emerald-100/70 font-code tracking-widest text-lg">ILS (₪)</p>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] text-white/10 group-hover:scale-110 transition-transform">currency_exchange</span>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <p className="text-sm font-bold text-on-surface-variant px-2">العملات المفعلة الأخرى</p>
            {currencies?.map((cur: any) => (
              <div key={cur.id} className="bg-surface-container-lowest p-5 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-emerald-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center font-bold text-lg text-emerald-900 shadow-inner group-hover:bg-emerald-50">
                    {cur.symbol}
                  </div>
                  <div>
                    <div className="font-bold text-on-surface">{cur.name}</div>
                    <div className="text-xs text-on-surface-variant font-code">{cur.code}</div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteCurrency(cur.id)}
                  className="p-3 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined">delete_forever</span>
                </button>
              </div>
            ))}
            {currencies?.length === 0 && (
              <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200 text-zinc-400">
                <span className="material-symbols-outlined text-4xl block mb-2">info</span>
                <p>لا توجد عملات إضافية مفعلة حالياً.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrenciesPage;
