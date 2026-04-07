import React from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const hrApi = api.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.query({
      query: () => 'employees/',
      providesTags: ['Employees'] as any,
    }),
    runPayroll: build.mutation({
      query: (body) => ({
        url: 'payroll-runs/run/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employees', 'Cash'] as any,
    }),
  }),
});

export const { useGetEmployeesQuery, useRunPayrollMutation } = hrApi;

export default function PayrollPage() {
  const { showToast } = useToast();
  const { data: employees, isLoading, refetch } = useGetEmployeesQuery({});
  const [runPayroll, { isLoading: isRunning }] = useRunPayrollMutation();

  const handleRunPayroll = async () => {
    if (!window.confirm('هل أنت متأكد من صرف الرواتب؟ سيتم توليد قيود مالية آلية.')) return;
    try {
      await runPayroll({}).unwrap();
      showToast('تم صرف الرواتب وتوليد القيود المحاسبية بنجاح.', 'success');
      refetch();
    } catch (err: any) {
      showToast(`خطأ: ${err?.data?.error || 'حدث خطأ'}`, 'error');
    }
  };

  if (isLoading || isRunning) return <VegetableLoader text="جاري تحميل بيانات الموظفين والرواتب..." />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">groups</span>
             شؤون الموظفين والرواتب
          </h2>
          <p className="text-zinc-500 font-bold mt-1">إدارة الموظفين، السلف، واعتماد الرواتب المحاسبية تلقائياً.</p>
        </div>
        <button onClick={handleRunPayroll} disabled={isRunning} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all">
          <span className="material-symbols-outlined align-middle mr-2">price_check</span>
          صرف رواتب الشهر الحالي
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100 p-6">
         <h3 className="text-xl font-black mb-6">قائمة الموظفين وسجل الإضافي/الدين</h3>
         {/* Simple list or table representing employees goes here */}
         <div className="text-center text-zinc-400 font-bold p-12 bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
            جارِ إضافة قائمة الموظفين...
         </div>
      </div>
    </div>
  );
}
