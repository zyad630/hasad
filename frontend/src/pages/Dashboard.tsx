import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/baseApi';
import { VegetableLoader } from '../components/ui/VegetableLoader';
import { useGetShipmentsQuery } from './shipments/Shipments';

const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query({
      query: () => 'reports/dashboard/',
      providesTags: ['Sales', 'Shipments'] as any,
    }),
    getAgingReport: build.query({
      query: () => 'reports/aging/',
    }),
  }),
});

export const { useGetDashboardQuery, useGetAgingReportQuery } = reportsApi;

export default function Dashboard() {
  const { data: dashboard, isLoading: dashLoading, refetch: dashRefetch } = useGetDashboardQuery({});
  const { data: agingData, isLoading: agingLoading, refetch: agingRefetch } = useGetAgingReportQuery({});
  const { data: shipmentsData, isLoading: shipLoading, refetch: shipRefetch } = useGetShipmentsQuery({});
  const navigate = useNavigate();

  if (dashLoading || agingLoading || shipLoading) return <VegetableLoader text="جاري التحميل..." size="lg" fullScreen={false} />;

  const shipments = shipmentsData?.results || (Array.isArray(shipmentsData) ? shipmentsData : []);
  const recentShipments = shipments.slice(0, 5);

  const handleRefresh = () => {
    dashRefetch();
    agingRefetch();
    shipRefetch();
  };

  return (
    <div>
      {/* ── Page Title ── */}
      <div className="page-title">
        <div className="title-text">
          <h2>لوحة التحكم</h2>
          <p>متابعة المبيعات، المشتريات، والسيولة النقدية في الوقت الفعلي.</p>
        </div>
        <div className="title-actions">
          <button className="btn btn-ghost" title="تحديث البيانات" onClick={handleRefresh}>
            <i className="fa-solid fa-arrows-rotate"></i>
          </button>
          <button className="btn btn-outline-primary" onClick={() => navigate('/reports')}>
            <i className="fa-solid fa-chart-line"></i> تقرير الأداء
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            <i className="fa-solid fa-plus"></i> حركة جديدة
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="stat-info">
            <h4>مبيعات اليوم</h4>
            <span className="stat-value">{Number(dashboard?.total_sales_today || 0).toLocaleString()} <small>₪</small></span>
            <div className="stat-sub">{dashboard?.sales_count_today || 0} عملية</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><i className="fa-solid fa-percent"></i></div>
          <div className="stat-info">
            <h4>إجمالي الكمسيون</h4>
            <span className="stat-value">{Number(dashboard?.total_commission_today || 0).toLocaleString()} <small>₪</small></span>
            <div className="stat-sub">العمولة المستقطعة</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><i className="fa-solid fa-truck"></i></div>
          <div className="stat-info">
            <h4>مشتريات اليوم</h4>
            <span className="stat-value">{Number(dashboard?.total_purchases_today || 0).toLocaleString()} <small>₪</small></span>
            <div className="stat-sub">فواتير المزارعين</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><i className="fa-solid fa-wallet"></i></div>
          <div className="stat-info">
            <h4>رصيد الصندوق</h4>
            <span className="stat-value">{Number(dashboard?.cash_balance || 0).toLocaleString()} <small>₪</small></span>
            <div className="stat-sub">السيولة المتاحة</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><i className="fa-solid fa-money-check"></i></div>
          <div className="stat-info">
            <h4>صندوق الشيكات</h4>
            <span className="stat-value">{Number(dashboard?.check_balance || 0).toLocaleString()} <small>₪</small></span>
            <div className="stat-sub">آجل التحصيل</div>
          </div>
        </div>
      </div>

      {/* ── Content Grid ── */}
      <div className="content-grid">
        
        {/* Recent Transactions Table */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fa-solid fa-clock-rotate-left" style={{color:'var(--primary)', marginLeft:'6px'}}></i> آخر الحركات النشطة</h3>
            <button className="btn btn-ghost btn-sm">عرض الكل</button>
          </div>
          <div className="card-body" style={{padding:0}}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المسلسل</th>
                    <th>المورد</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShipments.map((s: any) => (
                    <tr key={s.id}>
                      <td style={{fontWeight:800, color:'var(--text-muted)'}}>#{s.id.toString().substring(0,6)}</td>
                      <td style={{fontWeight:700}}>{s.supplier_name}</td>
                      <td><span className="badge badge-info"><i className="fa-solid fa-truck-ramp-box" style={{marginLeft:'4px'}}></i> إرسالية</span></td>
                      <td>
                        {s.status === 'open' 
                          ? <span className="badge badge-warning">مفتوحة</span>
                          : <span className="badge badge-success">مغلقة</span>}
                      </td>
                      <td style={{fontWeight:800, color:'var(--primary)'}}>{s.total_commission} <small>₪</small></td>
                    </tr>
                  ))}
                  {recentShipments.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">لا توجد حركات مسجلة حالياً</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Column Data */}
        <div className="side-col">
          <div className="card" style={{borderRight: '4px solid var(--danger)'}}>
            <div className="card-header">
              <h3><i className="fa-solid fa-circle-exclamation" style={{color:'var(--danger)', marginLeft:'6px'}}></i> أعلى الذمم</h3>
            </div>
            <div className="card-body">
               <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                 {agingData?.top_debtors?.slice(0, 4).map((d: any, idx: number) => (
                   <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
                      <div>
                         <div style={{fontWeight:700, fontSize:'14px'}}>{d.customer_name}</div>
                         <div style={{fontSize:'12px', color:'var(--text-muted)'}}>زبون</div>
                      </div>
                      <div style={{fontWeight:900, fontSize:'16px', color:'var(--danger)'}}>{Math.abs(d.balance).toLocaleString()} <small>₪</small></div>
                   </div>
                 ))}
                 {(!agingData?.top_debtors || agingData.top_debtors.length === 0) && (
                   <div className="empty-state" style={{padding:'20px'}}>
                      <i className="fa-solid fa-check-circle" style={{color:'var(--primary)', marginBottom:'10px', fontSize:'32px'}}></i>
                      <p>لا توجد ديون مستحقة</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
