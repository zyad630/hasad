import React from 'react';
import { createPortal } from 'react-dom';
import { useGetTenantActivityQuery } from './superAdminApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  tenantId: string;
  onClose: () => void;
}

const TenantActivityModal: React.FC<Props> = ({ tenantId, onClose }) => {
  const { data, isLoading } = useGetTenantActivityQuery(tenantId);

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-white flex flex-col h-[90vh] animate-fade-in overflow-hidden" dir="rtl">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-xl font-black text-slate-800">
              {isLoading ? 'جاري التحميل...' : `نشاط الشركة: ${data?.tenant_details.name}`}
            </h3>
            <span className="text-slate-500 font-code text-sm block mt-1" dir="ltr">{data?.tenant_details.subdomain}.domain.com</span>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-200 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>
        
        <div className="p-8 flex-1 overflow-y-auto space-y-8 bg-slate-50/30">
          {isLoading ? <div className="text-center font-bold text-slate-500">جاري تجميع البيانات الإحصائية للـ 30 يوماً الماضية...</div> : (
             <>
               {/* Recharts Block */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h4 className="font-bold text-slate-700 mb-6">منحنى المبيعات والعمولات (30 يوم)</h4>
                  <div className="h-[300px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data?.snapshots_30d || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                          itemStyle={{fontWeight: 'bold'}}
                        />
                        <Line type="monotone" dataKey="sales_total" name="المبيعات (ج.م)" stroke="#10b981" strokeWidth={4} dot={false} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="commissions_earned" name="العمولات" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Recent 20 Operations */}
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-700">آخر 20 عملية تشغيلية (Audit Trail)</h4>
                 </div>
                 <table className="w-full text-right text-sm">
                   <thead className="bg-slate-50 text-slate-500 text-xs">
                     <tr>
                       <th className="px-6 py-3 font-bold">الحركة</th>
                       <th className="px-6 py-3 font-bold">المستخدم</th>
                       <th className="px-6 py-3 font-bold">التوقيت</th>
                       <th className="px-6 py-3 font-bold">التأثير (Delta)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {data?.recent_logs?.map((log: any) => (
                       <tr key={log.id} className="hover:bg-slate-50">
                         <td className="px-6 py-4 font-bold text-slate-800">{log.action}</td>
                         <td className="px-6 py-4 text-slate-600">{log.user}</td>
                         <td className="px-6 py-4 text-slate-400 text-xs">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                         <td className="px-6 py-4">
                           {/* Highlight changes in Green/Red based on delta keys conceptually */}
                           <pre className="text-[11px] font-code bg-slate-100/50 p-2 rounded text-slate-600 w-full overflow-x-auto">
                              {JSON.stringify(log.delta)}
                           </pre>
                         </td>
                       </tr>
                     ))}
                     {data?.recent_logs?.length === 0 && (
                       <tr><td colSpan={4} className="p-6 text-center text-slate-400 font-bold">لم يقم العميل بأي حركات بعد</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </>
          )}
        </div>
      </div>
    </div>
  , document.body);
};

export default TenantActivityModal;
