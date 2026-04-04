import { Link } from 'react-router-dom';
import { api } from '../api/baseApi';
import { PageSkeleton } from '../components/Skeleton';
import { useGetShipmentsQuery } from './shipments/Shipments';

const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query({
      query: () => 'reports/dashboard/',
      providesTags: ['Sales', 'Shipments', 'Settlements', 'Cash'],
    }),
    getAgingReport: build.query({
      query: () => 'reports/aging/',
      providesTags: ['Sales', 'Suppliers', 'Customers'],
    }),
  }),
});

export const { useGetDashboardQuery, useGetAgingReportQuery } = reportsApi;

export default function Dashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetDashboardQuery({});
  const { data: agingData, isLoading: agingLoading } = useGetAgingReportQuery({});
  const { data: shipmentsData, isLoading: shipLoading } = useGetShipmentsQuery({});

  if (dashLoading || agingLoading || shipLoading) return <PageSkeleton titleWidth="200px" cards={4} />;

  const shipments = shipmentsData?.results || (Array.isArray(shipmentsData) ? shipmentsData : []);
  const recentShipments = shipments.slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Quick Stats Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Sales */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 bg-primary-fixed h-full"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-primary">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">يومي</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">مبيعات اليوم</p>
            <h3 className="text-3xl font-bold tracking-tight text-on-surface">
              {dashboard?.today_sales?.toFixed(0) || 0} <span className="text-sm font-normal text-zinc-400">ج.م</span>
            </h3>
          </div>
        </div>

        {/* Stat 2: Box Balance */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 bg-secondary h-full"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-secondary">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">رصيد الصندوق</p>
            <h3 className="text-3xl font-bold tracking-tight text-on-surface">
              {dashboard?.cash_balance?.toFixed(0) || 0} <span className="text-sm font-normal text-zinc-400">ج.م</span>
            </h3>
          </div>
        </div>

        {/* Stat 3: Supplier Debts / Open Shipments */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 bg-error h-full"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-xl text-error">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">إرساليات معلقة</p>
            <h3 className="text-3xl font-bold tracking-tight text-on-surface">
              {dashboard?.open_shipments || 0} <span className="text-sm font-normal text-zinc-400">إرسالية</span>
            </h3>
          </div>
        </div>

        {/* Stat 4: Customer Debts */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 bg-primary-fixed h-full"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-primary">
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">تصفيات بانتظار المالية</p>
            <h3 className="text-3xl font-bold tracking-tight text-on-surface">
              {dashboard?.pending_settlements || 0} <span className="text-sm font-normal text-zinc-400">تصفية</span>
            </h3>
          </div>
        </div>
      </section>

      {/* AI Alerts Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold">
          <span className="material-symbols-outlined text-emerald-600">auto_awesome</span>
          <h4 className="text-lg">تنبيهات الذكاء الاصطناعي الذكية</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agingData && agingData.filter((a: any) => a.bucket === 'over_30').length > 0 ? (
            <div className="bg-white/40 border border-red-100 backdrop-blur-md p-4 rounded-2xl flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-900">warning</span>
              </div>
              <div>
                <h5 className="font-bold text-red-900">ديون عملاء متأخرة</h5>
                <p className="text-sm text-zinc-600 mt-1">يوجد عدد {agingData.filter((a: any) => a.bucket === 'over_30').length} عملاء تأخر سدادهم لأكثر من 30 يوماً. يجب اتخاذ إجراء تحصيلي.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/40 border border-emerald-100 backdrop-blur-md p-4 rounded-2xl flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-emerald-900">verified</span>
              </div>
              <div>
                <h5 className="font-bold text-emerald-900">وضع التحصيل ممتاز</h5>
                <p className="text-sm text-zinc-600 mt-1">لا توجد مديونيات خطرة أو متأخرة عن المدة المسموحة. حالة الذمم المالية صحية.</p>
              </div>
            </div>
          )}

          <div className="bg-white/40 border border-secondary-container/20 backdrop-blur-md p-4 rounded-2xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary">inventory</span>
            </div>
            <div>
              <h5 className="font-bold text-secondary">متابعة الفوارغ</h5>
              <p className="text-sm text-zinc-600 mt-1">تأكد من مطابقة فوارغ آخر الإرساليات مع الرصيد المسجل. النظام يسجل نشاط استلام صناديق مستمر خلال الأسبوع.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Shipments (Editorial List style) */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h4 className="text-xl font-bold text-on-surface">آخر الإرساليات الواردة</h4>
          <Link className="text-emerald-700 font-medium text-sm hover:underline" to="/shipments">عرض جميع الإرساليات</Link>
        </div>
        
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-zinc-100">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-none">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-5 text-sm font-bold text-zinc-500 border-b border-zinc-200">رقم البوليصة</th>
                  <th className="px-6 py-5 text-sm font-bold text-zinc-500 border-b border-zinc-200">المورد</th>
                  <th className="px-6 py-5 text-sm font-bold text-zinc-500 text-center border-b border-zinc-200">الأصناف</th>
                  <th className="px-6 py-5 text-sm font-bold text-zinc-500 border-b border-zinc-200">تاريخ الاستلام</th>
                  <th className="px-6 py-5 text-sm font-bold text-zinc-500 text-center border-b border-zinc-200">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {recentShipments.map((shipment: any) => (
                  <tr key={shipment.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-5 font-code text-on-surface">#{shipment.id.substring(0,6)}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-xs font-bold text-emerald-900 border border-emerald-100">
                          <span className="material-symbols-outlined text-sm">person</span>
                        </div>
                        <span className="font-bold text-on-surface">{shipment.supplier_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center font-bold text-primary">{shipment.items?.length || 0}</td>
                    <td className="px-6 py-5 text-zinc-500 text-sm font-code" dir="ltr">{shipment.shipment_date}</td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${shipment.status === 'open' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                        {shipment.status === 'open' ? 'قيد البيع' : 'مصـفّاة'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentShipments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">لا يوجد إرساليات قيد التشغيل حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
