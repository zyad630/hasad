import React from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const checksApi = api.injectEndpoints({
  endpoints: (build) => ({
    getChecks: build.query({
      query: (type = 'receivable') => `checks/?type=${type}`,
      providesTags: ['Cash'],
    }),
    depositCheck: build.mutation({
      query: (id) => ({
        url: `checks/${id}/deposit/`,
        method: 'POST',
      }),
      invalidatesTags: ['Cash'],
    }),
    clearCheck: build.mutation({
      query: (id) => ({
        url: `checks/${id}/clear/`,
        method: 'POST',
      }),
      invalidatesTags: ['Cash'],
    }),
    bounceCheck: build.mutation({
      query: (id) => ({
        url: `checks/${id}/bounce/`,
        method: 'POST',
      }),
      invalidatesTags: ['Cash'],
    }),
  }),
});

export const { useGetChecksQuery, useDepositCheckMutation, useClearCheckMutation, useBounceCheckMutation } = checksApi;

export default function ChecksPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'receivable' | 'payable'>('receivable');
  const { data: checks, isLoading, refetch } = useGetChecksQuery(activeTab);
  
  const [depositCheck] = useDepositCheckMutation();
  const [clearCheck] = useClearCheckMutation();
  const [bounceCheck] = useBounceCheckMutation();

  const handleAction = async (action: any, id: string) => {
    try {
      await action(id).unwrap();
      showToast('تم تحديث حالة الشيك بنجاح (وتم توليد القيود آلياً)', 'success');
      refetch();
    } catch (err: any) {
      showToast(`خطأ: ${err?.data?.error || 'حدث خطأ غير معروف'}`, 'error');
    }
  };

  if (isLoading) return <VegetableLoader text="جاري تحميل الشيكات والكمبيالات..." />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">account_balance</span>
             إدارة الشيكات والكمبيالات
          </h2>
          <p className="text-zinc-500 font-bold mt-1">دورة حياة الشيك وتوليد القيود المحاسبية التلقائية.</p>
        </div>
        <div className="flex p-1 bg-zinc-100 rounded-2xl w-full md:w-auto overflow-hidden">
          <button 
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'receivable' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('receivable')}
          >
            شيكات واردة (مقبوضة)
          </button>
          <button 
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'payable' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('payable')}
          >
            شيكات صادرة (مدفوعة)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-5">رقم الشيك</th>
                <th className="px-6 py-5">البنك</th>
                <th className="px-6 py-5">العميل / المزارع</th>
                <th className="px-6 py-5">المبلغ</th>
                <th className="px-6 py-5">تاريخ الاستحقاق</th>
                <th className="px-6 py-5">الحالة الحالية</th>
                <th className="px-6 py-5 text-center">الإجراءات المحاسبية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(checks || []).map((check: any) => (
                <tr key={check.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-6 py-4 font-black text-sm text-zinc-700 font-code">{check.check_number}</td>
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 border-x border-zinc-50">{check.bank_name || check.bank.name}</td>
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 border-x border-zinc-50">{check.drawer_name || 'غير محدد'}</td>
                  <td className="px-6 py-4 border-x border-zinc-50">
                    <span className="text-lg font-black text-emerald-600">{parseFloat(check.amount).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-[11px] text-zinc-500 uppercase border-x border-zinc-50">
                    {new Date(check.due_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4 border-x border-zinc-50">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                      check.status === 'in_wallet' ? 'bg-amber-50 text-amber-600' :
                      check.status === 'deposited' ? 'bg-indigo-50 text-indigo-600' :
                      check.status === 'cleared' ? 'bg-emerald-50 text-emerald-600' :
                      check.status === 'bounced' ? 'bg-rose-50 text-rose-600' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {check.status === 'in_wallet' ? 'في الخزينة' :
                       check.status === 'deposited' ? 'بانتظار التحصيل' :
                       check.status === 'cleared' ? 'مُحصّل' :
                       check.status === 'bounced' ? 'مرتجع' : 'ملغي'}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-x border-zinc-50 flex justify-center gap-2">
                    {check.status === 'in_wallet' && (
                      <button onClick={() => handleAction(depositCheck, check.id)} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">إيداع بالبنك</button>
                    )}
                    {check.status === 'deposited' && (
                      <>
                        <button onClick={() => handleAction(clearCheck, check.id)} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all">تم التحصيل</button>
                        <button onClick={() => handleAction(bounceCheck, check.id)} className="px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-600 hover:text-white transition-all">إرجاع</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {(!checks || checks.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">لا توجد أي بيانات متاحة حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
