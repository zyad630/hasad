import React from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const hrApi = api.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.query({
      query: () => 'employees/',
      providesTags: ['Employees'],
    }),
    createEmployee: build.mutation({
      query: (body) => ({
        url: 'employees/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employees'],
    }),
    runPayroll: build.mutation({
      query: (body) => ({
        url: 'payroll-runs/run/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employees', 'Cash'],
    }),
  }),
});

export const { useGetEmployeesQuery, useCreateEmployeeMutation, useRunPayrollMutation } = hrApi;

export default function PayrollPage() {
  const { showToast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const showAddForm = searchParams.get('add') === '1';
  
  const { data: employees, isLoading, refetch } = useGetEmployeesQuery({});
  const [runPayroll, { isLoading: isRunning }] = useRunPayrollMutation();
  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();

  const [form, setForm] = React.useState({
    name: '', job_title: '', basic_salary: '', phone: '', hire_date: new Date().toISOString().split('T')[0]
  });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEmployee(form).unwrap();
      showToast('تمت إضافة الموظف بنجاح', 'success');
      setForm({ name: '', job_title: '', basic_salary: '', phone: '', hire_date: new Date().toISOString().split('T')[0] });
      window.history.replaceState({}, '', window.location.pathname);
      refetch();
    } catch (err: any) {
      showToast('خطأ في إضافة الموظف', 'error');
    }
  };

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
        <div className="flex gap-4">
            <button 
                onClick={() => window.history.pushState({}, '', '?add=1')}
                className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all border border-zinc-200"
            >
                إضافة موظف +
            </button>
            <button onClick={handleRunPayroll} disabled={isRunning} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined align-middle mr-2">price_check</span>
                صرف رواتب الشهر الحالي
            </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-8 mb-8 animate-slide-up">
            <h3 className="text-xl font-black mb-6 text-emerald-900">إضافة موظف جديد</h3>
            <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                    <label className="block text-xs font-black text-emerald-800 mb-2 uppercase tracking-wider">اسم الموظف مزارع</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 h-[54px] font-bold" placeholder="الاسم ثلاثي" />
                </div>
                <div>
                    <label className="block text-xs font-black text-emerald-800 mb-2 uppercase tracking-wider">المسمى الوظيفي</label>
                    <input value={form.job_title} onChange={e => setForm({...form, job_title: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 h-[54px] font-bold" placeholder="مثلاً: سائق، عامل..." />
                </div>
                <div>
                    <label className="block text-xs font-black text-emerald-800 mb-2 uppercase tracking-wider">الراتب الأساسي</label>
                    <input required type="number" value={form.basic_salary} onChange={e => setForm({...form, basic_salary: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 h-[54px] font-bold" placeholder="0.00" />
                </div>
                <div>
                    <label className="block text-xs font-black text-emerald-800 mb-2 uppercase tracking-wider">رقم الهاتف</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 h-[54px] font-bold" placeholder="05xxxxxxxx" />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-4">
                    <button type="button" onClick={() => window.history.replaceState({}, '', window.location.pathname)} className="px-8 h-[54px] bg-white text-zinc-400 font-bold border border-zinc-200 rounded-xl">إلغاء</button>
                    <button disabled={isCreating} className="px-12 h-[54px] bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-900/10">حفظ الموظف</button>
                </div>
            </form>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100 min-h-[400px]">
          <div className="p-8 border-b border-zinc-50 flex justify-between items-center">
             <h3 className="text-xl font-black">قائمة الموظفين وسجل المستحقات</h3>
             <div className="text-xs font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1 rounded-full">
                إجمالي الموظفين: {(employees?.results?.length || employees?.length || 0)}
             </div>
          </div>
          
          <table className="w-full text-right border-collapse">
             <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[11px] font-black uppercase tracking-tighter border-b border-zinc-100">
                    <th className="px-8 py-5">الموظف</th>
                    <th className="px-8 py-5">المسمى الوظيفي</th>
                    <th className="px-8 py-5">الراتب الأساسي</th>
                    <th className="px-8 py-5">رقم الهاتف</th>
                    <th className="px-8 py-5">الحالة</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-zinc-50">
                {(employees?.results || employees || []).map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-8 py-6">
                            <div className="font-black text-zinc-800">{emp.name}</div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">منذ: {emp.hire_date}</div>
                        </td>
                        <td className="px-8 py-6 font-bold text-zinc-500">{emp.job_title || '---'}</td>
                        <td className="px-8 py-6">
                            <span className="font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">
                                {parseFloat(emp.basic_salary).toLocaleString()} ₪
                            </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-zinc-400">{emp.phone || '---'}</td>
                        <td className="px-8 py-6">
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {emp.status === 'active' ? 'نشط' : 'غير نشط'}
                            </span>
                        </td>
                    </tr>
                ))}
             </tbody>
          </table>
          
          {(!employees || employees?.length === 0) && (
             <div className="text-center text-zinc-400 font-bold p-12 py-32">
                <span className="material-symbols-outlined text-6xl block mb-4 scale-150 text-zinc-100">person_off</span>
                لا يوجد موظفين مسجلين حالياً.
             </div>
          )}
      </div>
    </div>
  );
}
