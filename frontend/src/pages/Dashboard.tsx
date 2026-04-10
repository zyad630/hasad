/**
 * Dashboard — Real-time daily stats (Request 7)
 * Shows: مبيعات اليوم, ذمم العملاء, إرساليات مفتوحة, مستحقات الموردين
 * Quick report buttons and last 5 transactions
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/baseApi';
import { VegetableLoader } from '../components/ui/VegetableLoader';

const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query({
      query: () => 'reports/dashboard/',
      // Re-fetches whenever any of these tags are invalidated (sale, cash, market movement...)
      providesTags: ['Sales', 'Shipments', 'Cash', 'Movements', 'Settlements', 'Customers', 'Suppliers'] as any,
    }),
  }),
});

export const { useGetDashboardQuery } = reportsApi;

// Number card component
function KpiCard({ label, value, sub, color, icon, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: '20px', padding: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: `2px solid ${color}20`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
      onMouseOver={e => { if (onClick) { (e.currentTarget as any).style.transform = 'translateY(-3px)'; (e.currentTarget as any).style.boxShadow = `0 8px 24px ${color}25`; } }}
      onMouseOut={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
          {icon}
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', background: '#f9fafb', padding: '3px 8px', borderRadius: '6px' }}>اليوم</span>
      </div>
      <div>
        <div style={{ fontSize: '26px', fontWeight: 900, color: color, fontFamily: 'monospace', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginTop: '4px' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: dashboard, isLoading, refetch } = useGetDashboardQuery({});
  const navigate = useNavigate();

  if (isLoading) return <VegetableLoader text="جاري تحميل اللوحة..." size="lg" fullScreen={false} />;

  const d = dashboard || {};
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div style={{ direction: 'rtl' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-title">
        <div className="title-text">
          <h2>لوحة التحكم اليومية</h2>
          <p>البيانات الحية لهذا اليوم — {d.today_date || new Date().toLocaleDateString('en-US')}</p>
        </div>
        <div className="title-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" title="تحديث" onClick={() => refetch()}>
            <i className="fa-solid fa-arrows-rotate"></i>
          </button>
          <button className="btn btn-outline-primary" onClick={() => navigate('/accounting/statement')}>
            <i className="fa-solid fa-file-lines"></i> كشف حساب
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            <i className="fa-solid fa-plus"></i> فاتورة جديدة
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard
          label="مبيعات اليوم"
          value={fmt(d.sales_today)}
          sub={`${d.sales_today_count || 0} فاتورة`}
          color="#059669" icon="📈"
          onClick={() => navigate('/reports')}
        />
        <KpiCard
          label="إرساليات مفتوحة"
          value={d.open_shipments || 0}
          sub={`${d.today_shipments || 0} واردة اليوم`}
          color="#0284c7" icon="📦"
          onClick={() => navigate('/shipments')}
        />
        <KpiCard
          label="ذمم العملاء"
          value={fmt(d.total_receivables)}
          sub="إجمالي الذمم الدائنة"
          color="#f59e0b" icon="👥"
          onClick={() => navigate('/accounting/statement')}
        />
        <KpiCard
          label="مستحقات الموردين"
          value={fmt(d.total_payables)}
          sub={`${d.active_suppliers || 0} مورد نشط`}
          color="#dc2626" icon="🌾"
          onClick={() => navigate('/suppliers')}
        />
      </div>

      {/* ── Quick Report Buttons ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'كشف حساب', icon: '📋', path: '/accounting/statement' },
          { label: 'ذمم العملاء', icon: '💰', path: '/suppliers?tab=customers' },
          { label: 'ذمم المزارعين', icon: '🌿', path: '/suppliers?tab=suppliers' },
          { label: 'أرصدة المخزون', icon: '📊', path: '/inventory' },
          { label: 'التقارير', icon: '📈', path: '/reports' },
        ].map(b => (
          <button key={b.path} onClick={() => navigate(b.path)} style={{
            padding: '10px 18px', borderRadius: '12px', border: '2px solid #e5e7eb',
            background: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.15s',
          }}
            onMouseOver={e => { (e.currentTarget as any).style.borderColor = '#059669'; (e.currentTarget as any).style.color = '#059669'; }}
            onMouseOut={e => { (e.currentTarget as any).style.borderColor = '#e5e7eb'; (e.currentTarget as any).style.color = '#1f2937'; }}
          >
            <span>{b.icon}</span> {b.label}
          </button>
        ))}
      </div>

      {/* ── Recent Transactions ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Recent Sales */}
        <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', background: '#f0fdf4', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: '#065f46' }}>📋 آخر فواتير المبيعات</h3>
            <button onClick={() => navigate('/reports/unified-statement')} style={{ fontSize: '12px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>عرض الكل ←</button>
          </div>
          {(!d.recent_sales || d.recent_sales.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#d1d5db', fontWeight: 600, fontSize: '13px' }}>لا توجد مبيعات اليوم</div>
          ) : (d.recent_sales || []).map((s: any, i: number) => (
            <div key={i} style={{ padding: '10px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>فاتورة #{typeof s.id === 'string' ? s.id.slice(-6) : s.id}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {s.payment_type === 'cash' ? '💵 كاش' : '📋 ذمة'} · {new Date(s.sale_date || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', color: '#059669', fontFamily: 'monospace' }}>
                {fmt(s.foreign_amount)} {s.currency_code}
              </span>
            </div>
          ))}
        </div>

        {/* Recent Purchases/Shipments */}
        <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: '#1d4ed8' }}>📦 آخر الإرساليات</h3>
            <button onClick={() => navigate('/shipments')} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>عرض الكل ←</button>
          </div>
          {(!d.recent_purchases || d.recent_purchases.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#d1d5db', fontWeight: 600, fontSize: '13px' }}>لا توجد إرساليات</div>
          ) : (d.recent_purchases || []).map((p: any, i: number) => (
            <div key={i} style={{ padding: '10px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{p.supplier__name}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {p.shipment_date} · {p.status === 'open' ? <span style={{ color: '#059669' }}>مفتوحة</span> : <span style={{ color: '#9ca3af' }}>تمت التصفية</span>}
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: p.status === 'open' ? '#0284c7' : '#9ca3af', background: p.status === 'open' ? '#eff6ff' : '#f9fafb', padding: '3px 8px', borderRadius: '6px' }}>
                {p.deal_type === 'commission' ? 'كمسيون' : 'شراء مباشر'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
