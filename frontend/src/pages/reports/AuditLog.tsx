import React from 'react';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const auditApi = api.injectEndpoints({
    endpoints: (build) => ({
        getAuditLogs: build.query({
            query: () => 'audit-logs/',
            providesTags: ['Cash'], // Just a tag to refresh if needed
        }),
    }),
});

export const { useGetAuditLogsQuery } = auditApi;

export default function AuditLogPage() {
    const { data: logs, isLoading } = useGetAuditLogsQuery({});

    if (isLoading) return <VegetableLoader text="جاري تحميل سجل الرقابة والعمليات..." />;

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div>
                <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-rose-600">policy</span>
                    سجل الرقابة والتدقيق (Audit Log)
                </h2>
                <p className="text-zinc-500 font-bold mt-1">تتبع كافة العمليات، التعديلات، والحذف الذي تم في النظام لضمان الشفافية.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 text-zinc-400 text-[11px] font-black uppercase tracking-widest border-b border-zinc-100">
                            <th className="px-8 py-5">المستخدم</th>
                            <th className="px-8 py-5">الإجراء</th>
                            <th className="px-8 py-5">الكيان المتأثر</th>
                            <th className="px-8 py-5">تاريخ التعديل</th>
                            <th className="px-8 py-5">تفاصيل السجل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {(!logs || logs.length === 0) ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-zinc-300 font-bold">لا توجد سجلات بعد</td>
                            </tr>
                        ) : (
                            logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-black text-[10px] text-zinc-500">
                                                {log.username?.charAt(0) || 'U'}
                                            </div>
                                            <span className="font-black text-zinc-700">{log.username || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${
                                            log.action.includes('delete') ? 'bg-rose-100 text-rose-800' :
                                            log.action.includes('update') ? 'bg-amber-100 text-amber-800' :
                                            'bg-emerald-100 text-emerald-800'
                                        }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-bold text-zinc-600">{log.entity_type}</div>
                                        <div className="text-[10px] text-zinc-300 font-mono">{log.entity_id}</div>
                                    </td>
                                    <td className="px-8 py-6 text-zinc-400 font-bold text-xs" dir="ltr">
                                        {new Date(log.created_at).toLocaleString('ar-EG')}
                                    </td>
                                    <td className="px-8 py-6">
                                        <button 
                                            onClick={() => alert(JSON.stringify(log.delta, null, 2))}
                                            className="text-xs font-black text-emerald-600 hover:underline">
                                            عرض الفروقات
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
