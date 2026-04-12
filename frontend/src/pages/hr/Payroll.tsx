import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    getPayrollRuns: build.query({
      query: () => 'payroll-runs/',
      providesTags: ['Payroll'],
    }),
    runPayroll: build.mutation({
      query: (body) => ({
        url: 'payroll-runs/run/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employees', 'Cash', 'Payroll'],
    }),
  }),
});

export const { 
  useGetEmployeesQuery, 
  useCreateEmployeeMutation, 
  useRunPayrollMutation,
  useGetPayrollRunsQuery 
} = hrApi;

export default function PayrollPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const showAddForm = searchParams.get('add') === '1';
  
  const { data: employees, isLoading: loadingEmp, refetch: refetchEmp } = useGetEmployeesQuery({});
  const { data: runs, isLoading: loadingRuns } = useGetPayrollRunsQuery({});
  const [runPayroll, { isLoading: isRunning }] = useRunPayrollMutation();
  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();

  const [form, setForm] = useState({
    name: '', job_title: '', basic_salary: '', phone: '', hire_date: new Date().toISOString().split('T')[0]
  });

  // Payroll Period State
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [runDate, setRunDate] = useState(now.toISOString().split('T')[0]);

  // Overrides State { [empId]: { days_worked, deductions, bonuses } }
  const [overrides, setOverrides] = useState<Record<string, any>>({});

  useEffect(() => {
    if (employees) {
      const empList = employees.results || employees || [];
      const initial: Record<string, any> = {};
      empList.forEach((emp: any) => {
        if (emp.status === 'active') {
          initial[emp.id] = {
            days_worked: emp.working_days_per_month || 26,
            deductions: 0,
            bonuses: 0
          };
        }
      });
      setOverrides(initial);
    }
  }, [employees]);

  const updateOverride = (empId: string, field: string, value: any) => {
    setOverrides(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value
      }
    }));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEmployee(form).unwrap();
      showToast('تمت إضافة الموظف بنجاح', 'success');
      setForm({ name: '', job_title: '', basic_salary: '', phone: '', hire_date: new Date().toISOString().split('T')[0] });
      navigate(window.location.pathname);
      refetchEmp();
    } catch (err: any) {
      showToast('خطأ في إضافة الموظف', 'error');
    }
  };

  const handleRunPayroll = async () => {
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    if (!window.confirm(`هل أنت متأكد من صرف رواتب فترة ${period}؟ سيتم توليد قيود مالية آلية.`)) return;
    
    try {
      await runPayroll({ 
        run_date: runDate, 
        period,
        overrides 
      }).unwrap();
      showToast('تم صرف الرواتب وتوليد القيود المحاسبية بنجاح.', 'success');
      refetchEmp();
    } catch (err: any) {
      showToast(`خطأ: ${err?.data?.error || 'حدث خطأ'}`, 'error');
    }
  };

  if (loadingEmp || loadingRuns) return <VegetableLoader text="جاري تحميل بيانات الموظفين والرواتب..." />;

  const empList = employees?.results || employees || [];
  const activeEmployees = empList.filter((e: any) => e.status === 'active');

  return (
    <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">groups</span>
             شؤون الموظفين والرواتب
          </h2>
          <p className="text-zinc-500 font-bold mt-1">إدارة الموظفين والرواتب مع معالجة فترات زمنية دقيقة.</p>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={() => navigate('?add=1')}
                className="px-6 py-3 bg-white text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-all border border-emerald-100 shadow-sm"
            >
                إضافة موظف جديد +
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="text-zinc-400 text-xs font-black uppercase mb-2">إجمالي الموظفين</div>
              <div className="text-3xl font-black">{empList.length}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm text-emerald-600">
              <div className="text-zinc-400 text-xs font-black uppercase mb-2 text-zinc-400">الموظفين النشطين</div>
              <div className="text-3xl font-black">{activeEmployees.length}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="text-zinc-400 text-xs font-black uppercase mb-2">آخر تشغيل</div>
              <div className="text-xl font-black">{runs?.[0]?.period || '---'}</div>
          </div>
      </div>

      {showAddForm && (
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[2rem] p-8 mb-8 animate-slide-up shadow-inner">
            <h3 className="text-xl font-black mb-6 text-emerald-900">بيانات الموظف الجديد</h3>
            <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-800 uppercase">اسم الموظف</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-800 uppercase">المسمى الوظيفي</label>
                    <input value={form.job_title} onChange={e => setForm({...form, job_title: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-800 uppercase">الراتب الأساسي</label>
                    <input required type="number" value={form.basic_salary} onChange={e => setForm({...form, basic_salary: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none font-code" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-800 uppercase">رقم الهاتف</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-3 font-bold focus:border-emerald-500 outline-none" />
                </div>
                <div className="col-span-full flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => navigate(window.location.pathname)} className="px-8 py-3 bg-white text-zinc-400 font-bold border border-zinc-200 rounded-xl">إلغاء</button>
                    <button disabled={isCreating} className="px-12 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-600/20">حفظ الموظف</button>
                </div>
            </form>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        
        {/* Payroll Execution Card */}
        <div className="xl:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/30">
                    <div>
                        <h3 className="text-xl font-black">تشغيل رواتب الموظفين</h3>
                        <p className="text-xs text-zinc-400 font-bold mt-1">قم بتعديل أيام العمل والخصومات قبل الاعتماد.</p>
                    </div>
                    <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-zinc-200">
                        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-transparent border-none outline-none font-black px-3 py-1 text-sm">
                            {Array.from({length: 5}, (_, i) => now.getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="w-px h-6 bg-zinc-100 mt-1"></div>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent border-none outline-none font-black px-3 py-1 text-sm">
                            {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                                <th className="px-6 py-4">الموظف</th>
                                <th className="px-6 py-4">أيام العمل</th>
                                <th className="px-6 py-4">الخصومات (₪)</th>
                                <th className="px-6 py-4">المكافآت (₪)</th>
                                <th className="px-6 py-4">الصافي المتوقع</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {activeEmployees.map((emp: any) => {
                                const ov = overrides[emp.id] || { days_worked: emp.working_days_per_month, deductions: 0, bonuses: 0 };
                                const daily = parseFloat(emp.basic_salary) / (emp.working_days_per_month || 26);
                                const expectedNet = (daily * (ov.days_worked || 0)) + (parseFloat(ov.bonuses) || 0) - (parseFloat(ov.deductions) || 0);

                                return (
                                    <tr key={emp.id} className="hover:bg-zinc-50/30">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-black text-sm">{emp.name}</div>
                                            <div className="text-[10px] text-zinc-400 uppercase">{emp.job_title}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="number"
                                                value={ov.days_worked}
                                                onChange={e => updateOverride(emp.id, 'days_worked', e.target.value)}
                                                className="w-16 bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-center font-code font-bold text-sm"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="number"
                                                value={ov.deductions}
                                                onChange={e => updateOverride(emp.id, 'deductions', e.target.value)}
                                                className="w-24 bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-center font-code font-bold text-sm text-rose-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="number"
                                                value={ov.bonuses}
                                                onChange={e => updateOverride(emp.id, 'bonuses', e.target.value)}
                                                className="w-24 bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-center font-code font-bold text-sm text-emerald-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-black font-code text-sm text-zinc-800">
                                            {expectedNet.toFixed(2)} ₪
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 bg-zinc-50/50 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-zinc-100">
                   <div className="flex items-center gap-4">
                       <label className="text-sm font-bold text-zinc-500">تاريخ الصرف المحاسبي:</label>
                       <input type="date" value={runDate} onChange={e => setRunDate(e.target.value)} className="bg-white border border-zinc-200 px-4 py-2 rounded-xl font-code font-bold shadow-sm" />
                   </div>
                   <button 
                     onClick={handleRunPayroll} 
                     disabled={isRunning || activeEmployees.length === 0} 
                     className="px-12 py-4 bg-zinc-950 text-white rounded-[1.25rem] font-black shadow-2xl shadow-zinc-950/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                   >
                     <span className="material-symbols-outlined">payments</span>
                     تأكيد صرف الرواتب ({selectedYear}-{selectedMonth})
                   </button>
                </div>
            </div>
        </div>

        {/* History Sidebar */}
        <div className="space-y-6">
            <h4 className="text-lg font-black flex items-center gap-2">
                <span className="material-symbols-outlined">history</span>
                سجل الترحيل
            </h4>
            <div className="space-y-4">
                {(runs || []).slice(0, 10).map((run: any) => (
                    <div key={run.id} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-black text-lg">{run.period}</div>
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase">ترحيل مكتمل</span>
                        </div>
                        <div className="text-xs text-zinc-400 font-bold mb-3">{new Date(run.run_date).toLocaleDateString('en-GB')}</div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500 text-sm font-bold">{run.lines?.length} موظف</span>
                            <span className="font-black font-code text-emerald-700">{parseFloat(run.total_net).toLocaleString()} ₪</span>
                        </div>
                        <div className="absolute left-0 bottom-0 top-0 w-1.5 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
