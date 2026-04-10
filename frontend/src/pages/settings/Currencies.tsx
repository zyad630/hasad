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
    updateCurrency: build.mutation({
      query: ({ id, ...body }) => ({
        url: `currencies/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Currencies'],
    }),
    getExchangeRates: build.query({
      query: () => 'exchange-rates/',
      providesTags: ['ExchangeRates'],
    }),
    createExchangeRate: build.mutation({
      query: (body) => ({
        url: 'exchange-rates/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ExchangeRates'],
    }),
  }),
});

export const { 
  useGetCurrenciesQuery, useCreateCurrencyMutation, useDeleteCurrencyMutation, useUpdateCurrencyMutation,
  useGetExchangeRatesQuery, useCreateExchangeRateMutation
} = currencyApi;

const CurrenciesPage = () => {
  const { showToast } = useToast();
  const { data: currencies, isLoading } = useGetCurrenciesQuery({});
  const [createCurrency] = useCreateCurrencyMutation();
  const [deleteCurrency] = useDeleteCurrencyMutation();
  const [updateCurrency] = useUpdateCurrencyMutation();

  const [formData, setFormData] = useState({ code: '', name: '', symbol: '' });
  const [rateData, setRateData] = useState({ currency: '', rate: '', date: new Date().toISOString().split('T')[0] });

  const baseCurrency = (currencies || []).find((c: any) => c.is_base);
  const otherCurrencies = (currencies || []).filter((c: any) => !c.is_base);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCurrency(formData).unwrap();
      setFormData({ code: '', name: '', symbol: '' });
      showToast('تم تفعيل العملة بنجاح', 'success');
    } catch (err) {
      showToast('خطأ في إضافة العملة', 'error');
    }
  };

  const setAsBase = async (id: string) => {
     if (!window.confirm('هل أنت متأكد من تغيير العملة الأساسية؟ هذا سيؤثر على حسابات الميزانية.')) return;
     try {
       await updateCurrency({ id, is_base: true }).unwrap();
       showToast('تم تغيير العملة الأساسية بنجاح', 'success');
     } catch (err) {
       showToast('خطأ في تغيير العملة', 'error');
     }
  };

  const { data: exchangeRates } = useGetExchangeRatesQuery({});
  const [createExchangeRate] = useCreateExchangeRateMutation();

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createExchangeRate({
        currency: rateData.currency,
        rate: parseFloat(rateData.rate),
        date: rateData.date,
      }).unwrap();
      setRateData({ ...rateData, rate: '' });
      showToast('تم حفظ التسعيرة اليومية بنجاح', 'success');
    } catch (err) {
      showToast('خطأ في الحفظ او يوجد تسعيرة تسبق هذا اليوم', 'error');
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
              <h3 className="text-3xl font-black mb-1">{baseCurrency?.name || '---'}</h3>
              <p className="text-emerald-100/70 font-code tracking-widest text-lg">{baseCurrency?.code || '---'} ({baseCurrency?.symbol || ''})</p>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] text-white/10 group-hover:scale-110 transition-transform">currency_exchange</span>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <p className="text-sm font-bold text-on-surface-variant px-2">العملات المفعلة الأخرى</p>
            {otherCurrencies?.map((cur: any) => (
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
                <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setAsBase(cur.id)}
                      title="تعيين كعملة أساسية"
                      className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                      <span className="material-symbols-outlined">star_rate</span>
                    </button>
                    <button 
                      onClick={() => deleteCurrency(cur.id)}
                      title="حذف العملة"
                      className="p-3 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                      <span className="material-symbols-outlined">delete_forever</span>
                    </button>
                </div>
              </div>
            ))}
            {otherCurrencies?.length === 0 && (
              <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200 text-zinc-400">
                <span className="material-symbols-outlined text-4xl block mb-2">info</span>
                <p>لا توجد عملات إضافية مفعلة حالياً.</p>
              </div>
            )}
          </div>
          
          {/* Exchange Rates section */}
          <div className="mt-12 bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
             <h3 className="text-xl font-bold mb-6 text-indigo-900 border-b pb-4">إدارة أسعار الصرف</h3>
             
             <form onSubmit={handleRateSubmit} className="flex flex-col md:flex-row gap-4 items-end bg-indigo-50/50 p-4 rounded-2xl mb-8 border border-indigo-100">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-indigo-900/60 mb-2">العملة</label>
                  <select 
                    required 
                    value={rateData.currency}
                    onChange={e => setRateData({...rateData, currency: e.target.value})}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 h-[54px] font-bold text-indigo-900">
                     <option value="">اختر..</option>
                     {currencies?.map((c:any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-indigo-900/60 mb-2">السعر مقابل العملة الأساسية</label>
                  <input 
                    required type="number" step="0.000001"
                    value={rateData.rate}
                    onChange={e => setRateData({...rateData, rate: e.target.value})}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 h-[54px] font-bold text-indigo-900" placeholder="مثلا: 3.52" />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-indigo-900/60 mb-2">التاريخ</label>
                  <input 
                    required type="date"
                    value={rateData.date}
                    onChange={e => setRateData({...rateData, date: e.target.value})}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 h-[54px] font-bold text-indigo-900" />
                </div>
                <button className="bg-indigo-600 text-white px-8 h-[54px] rounded-xl font-black w-full md:w-auto hover:bg-indigo-700 transition">
                  حفظ السعر
                </button>
             </form>

             <table className="w-full text-right text-sm">
                <thead className="text-xs text-zinc-400 border-b border-zinc-100 font-bold uppercase tracking-wide">
                   <tr>
                     <th className="py-3 px-4">التاريخ</th>
                     <th className="py-3 px-4">العملة</th>
                     <th className="py-3 px-4">سعر الصرف الداخلي (Base = 1)</th>
                   </tr>
                </thead>
                <tbody>
                   {(exchangeRates || []).map((rate: any) => (
                     <tr key={rate.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="py-4 px-4 font-bold text-zinc-600">{rate.date}</td>
                        <td className="py-4 px-4 font-black text-indigo-900">{rate.currency_code}</td>
                        <td className="py-4 px-4 font-bold text-emerald-600">{rate.rate}</td>
                     </tr>
                   ))}
                   {exchangeRates?.length === 0 && (
                     <tr>
                        <td colSpan={3} className="py-8 text-center text-zinc-400 text-xs">لا يوجد أسعار مسجلة بعد</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrenciesPage;
