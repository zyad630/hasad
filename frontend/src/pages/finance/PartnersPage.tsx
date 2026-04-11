import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const financeApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPartners: build.query({
      query: () => 'partners/',
      providesTags: ['Partners'],
    }),
    createPartner: build.mutation({
      query: (body) => ({
        url: 'partners/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Partners'],
    }),
  }),
});

export const { useGetPartnersQuery, useCreatePartnerMutation } = financeApi;

export default function PartnersPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const showAddForm = searchParams.get('add') === '1';
  
  const { data: partners, isLoading } = useGetPartnersQuery({});
  const [createPartner, { isLoading: isCreating }] = useCreatePartnerMutation();

  const [form, setForm] = useState({
    name: '', phone: '', share_percentage: '0', initial_capital: '0', notes: ''
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPartner(form).unwrap();
      showToast('تمت إضافة الشريك بنجاح', 'success');
      setForm({ name: '', phone: '', share_percentage: '0', initial_capital: '0', notes: '' });
      navigate(window.location.pathname);
    } catch (err: any) {
      showToast('خطأ في الإضافة', 'error');
    }
  };

  if (isLoading) return <VegetableLoader text="جاري تحميل قائمة الشركاء..." />;

  const partnerList = partners?.results || partners || [];

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">handshake</span>
             إدارة الشركاء والمساهمين
          </h2>
          <p className="text-zinc-500 font-bold mt-1">تتبع الحصص، عمليات المَسحوب، وتوزيعات الأرباح.</p>
        </div>
        <button 
            onClick={() => navigate('?add=1')}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all"
        >
            إضافة شريك جديد +
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-2xl animate-slide-up">
            <h3 className="text-xl font-black mb-6">بيانات الشريك الجديد</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase">اسم الشريك</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase">رقم الهاتف</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase">نسبة الشراكة (%)</label>
                    <input type="number" step="0.01" value={form.share_percentage} onChange={e => setForm({...form, share_percentage: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none font-code" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase">رأس المال المبدئي</label>
                    <input type="number" value={form.initial_capital} onChange={e => setForm({...form, initial_capital: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none font-code" />
                </div>
                <div className="col-span-full space-y-2">
                    <label className="text-xs font-black text-zinc-400 uppercase">ملاحظات</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none h-24" />
                </div>
                <div className="col-span-full flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => navigate(window.location.pathname)} className="px-8 py-3 bg-white text-zinc-400 font-bold border border-zinc-200 rounded-xl">إلغاء</button>
                    <button disabled={isCreating} className="px-12 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg">حفظ البيانات</button>
                </div>
            </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partnerList.map((p: any) => (
              <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-2xl">
                          {p.name.charAt(0)}
                      </div>
                      <div className="text-right">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-widest">{p.share_percentage}% حصة</span>
                      </div>
                  </div>
                  
                  <h4 className="text-2xl font-black mb-1 text-on-surface">{p.name}</h4>
                  <p className="text-zinc-400 text-sm font-bold mb-6">{p.phone || 'بدون هاتف'}</p>
                  
                  <div className="flex justify-between items-end p-4 bg-zinc-50/50 rounded-2xl border border-zinc-50 font-code">
                      <div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">الرصيد الجاري</p>
                          <div className={`text-2xl font-black ${parseFloat(p.balance) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {parseFloat(p.balance).toLocaleString()} ₪
                          </div>
                      </div>
                      <button className="text-zinc-400 hover:text-emerald-600 p-2"><span className="material-symbols-outlined">receipt_long</span></button>
                  </div>
                  
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className={`w-3 h-3 rounded-full flex ${p.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </div>
              </div>
          ))}
      </div>

      {partnerList.length === 0 && !showAddForm && (
        <div className="text-center py-40 bg-zinc-50/50 rounded-[3rem] border border-dashed border-zinc-200">
            <span className="material-symbols-outlined text-6xl text-zinc-200 mb-4 block scale-150">diversity_3</span>
            <p className="text-zinc-400 font-bold">لا يوجد شركاء مسجلين حتى الآن.</p>
        </div>
      )}
    </div>
  );
}
