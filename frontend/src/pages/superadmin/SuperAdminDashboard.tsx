import { useState } from 'react';
import { useGetOverviewQuery, useGetTenantsQuery, useGetAuditLogsQuery } from './superAdminApi';
import TenantActivityModal from './TenantActivityModal';

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  const { data: overview, isLoading: overviewLoading } = useGetOverviewQuery({});
  const { data: tenants, isLoading: tenantsLoading } = useGetTenantsQuery({});
  const { data: auditLogs, isLoading: auditLoading } = useGetAuditLogsQuery({});

  if (overviewLoading || tenantsLoading) return <div className="p-10 font-bold text-center">جاري تحميل بيانات المنصة...</div>;

  return (
    <div className="w-full h-full min-h-screen bg-slate-50 text-slate-900 absolute inset-0 z-[1000] overflow-y-auto" dir="rtl">
      {/* Super Admin Header */}
      <header className="bg-slate-900 text-white p-6 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-2xl font-black text-emerald-400 tracking-tight">إدارة المنصة (Super Admin)</h1>
          <p className="text-slate-400 text-sm mt-1">مركز التحكم والمراقبة لجميع فروع ومحلات الحسبة</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            نظرة عامة
          </button>
          <button 
            onClick={() => setActiveTab('audit')} 
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'audit' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            سجل التدقيق والمراقبة
          </button>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
        {activeTab === 'overview' && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <span className="text-slate-500 text-sm font-bold mb-2">الشركات النشطة</span>
                <span className="text-4xl font-black text-emerald-600">{overview?.active_tenants || 0}</span>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <span className="text-slate-500 text-sm font-bold mb-2">الفترات التجريبية</span>
                <span className="text-4xl font-black text-blue-600">{overview?.trial_tenants || 0}</span>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <span className="text-slate-500 text-sm font-bold mb-2">مبيعات الأمس (المسجلة)</span>
                <span className="text-4xl font-black text-slate-800">{parseFloat(overview?.yesterday_sales || '0').toLocaleString()} ج.م</span>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <span className="text-slate-500 text-sm font-bold mb-2">التنبيهات التقنية</span>
                <span className="text-4xl font-black text-rose-600">{overview?.alerts_count || 0}</span>
              </div>
            </div>

            {/* Tenants List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800">الشركات المشتركة</h3>
              </div>
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-6 py-4 font-bold">اسم الشركة</th>
                    <th className="px-6 py-4 font-bold">المتجر الفرعي</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold">مبيعات الأمس</th>
                    <th className="px-6 py-4 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm font-medium">
                  {tenants?.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-900 font-bold">{t.name}</td>
                      <td className="px-6 py-4 text-slate-500 font-code" dir="ltr">{t.subdomain}.domain.com</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {t.status === 'active' ? 'نشط' : 'تجريبي'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{parseFloat(t.yesterday_sales || '0').toLocaleString()} ج.م</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setSelectedTenant(t.id)} className="text-emerald-600 hover:text-emerald-800 font-bold text-xs bg-emerald-50 px-4 py-2 rounded-lg transition-colors">
                          تفاصيل النشاط
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800">سجل المراقبة والتدقيق الشامل</h3>
                <span className="text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded-lg">جميع العمليات غير قابلة للحذف نهائياً للموثوقية</span>
             </div>
             {auditLoading ? <div className="p-8 text-center">جاري التحميل...</div> : (
               <div className="p-6">
                 {auditLogs?.map((log: any) => (
                   <div key={log.id} className="mb-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-bold">{log.tenant_name}</span>
                       <span className="text-sm font-bold text-slate-900">{log.action}</span>
                       <span className="text-xs text-slate-500">بواسطة: {log.user}</span>
                       <span className="text-xs text-slate-400 mr-auto">{new Date(log.timestamp).toLocaleString("ar-EG")}</span>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-lg text-xs font-code grid grid-cols-2 gap-4">
                       <div>
                         <span className="text-slate-400 block mb-1">الفرق (Delta)</span>
                         <pre className="text-emerald-700 font-bold whitespace-pre-wrap">{JSON.stringify(log.delta, null, 2)}</pre>
                       </div>
                       <div>
                         <span className="text-slate-400 block mb-1">نوع الكيان</span>
                         <span className="text-slate-700 font-bold">{log.entity_type}</span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </div>

      {selectedTenant && <TenantActivityModal tenantId={selectedTenant} onClose={() => setSelectedTenant(null)} />}
    </div>
  );
};

export default SuperAdminDashboard;
