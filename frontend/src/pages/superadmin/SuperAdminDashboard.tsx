import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { useToast } from '../../components/ui/Toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── API Slice ─────────────────────────────────────────────────────────────────
const superAdminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSupervisionOverview: build.query({ query: () => 'superadmin/overview/', providesTags: ['SuperAdmin'] as any }),
    getSuperAdminTenants: build.query({ query: () => 'superadmin/tenants/', providesTags: ['SuperAdmin'] as any }),
    createTenant: build.mutation({
      query: (body) => ({ url: 'auth/register-tenant/', method: 'POST', body }),
      invalidatesTags: ['SuperAdmin'] as any,
    }),
    toggleTenantStatus: build.mutation({
      query: ({ id, status }: { id: string; status: string }) => ({
        url: `tenants/${id}/`, method: 'PATCH', body: { status },
      }),
      invalidatesTags: ['SuperAdmin'] as any,
    }),
    deleteTenant: build.mutation({
      query: (id: string) => ({
        url: `tenants/${id}/`, method: 'DELETE',
      }),
      invalidatesTags: ['SuperAdmin'] as any,
    }),
  }),
});

export const {
  useGetSupervisionOverviewQuery,
  useGetSuperAdminTenantsQuery,
  useCreateTenantMutation,
  useToggleTenantStatusMutation,
  useDeleteTenantMutation,
} = superAdminApi;

// ── Mock chart data ───────────────────────────────────────────────────────────
const mockData = [
  { name: 'يناير', value: 400 }, { name: 'فبراير', value: 700 },
  { name: 'مارس', value: 1200 }, { name: 'أبريل', value: 2100 },
  { name: 'مايو', value: 3800 },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { showToast } = useToast();
  const { data: overview, isLoading: loadingOverview } = useGetSupervisionOverviewQuery({});
  const { data: tenants, isLoading: loadingTenants, refetch } = useGetSuperAdminTenantsQuery({});
  const [createTenant, { isLoading: isCreating }] = useCreateTenantMutation();
  const [toggleStatus] = useToggleTenantStatusMutation();
  const [deleteTenant] = useDeleteTenantMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    tenant_name: '', subdomain: '', owner_username: '', owner_password: '', role: 'owner',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTenant(formData).unwrap();
      showToast('تم إنشاء مساحة العمل بنجاح! 🎉', 'success');
      setIsModalOpen(false);
      setFormData({ tenant_name: '', subdomain: '', owner_username: '', owner_password: '', role: 'owner' });
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'خطأ في إنشاء الحساب، تحقق من البيانات', 'error');
    }
  };

  const handleToggle = async (tenant: any) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await toggleStatus({ id: tenant.id, status: newStatus }).unwrap();
      showToast(
        newStatus === 'active' ? `تم تفعيل ${tenant.name} ✅` : `تم إيقاف ${tenant.name} ⛔`,
        newStatus === 'active' ? 'success' : 'warning'
      );
    } catch {
      showToast('فشل تغيير حالة الحساب، حاول مجدداً', 'error');
    }
  };

  const handleDelete = async (tenant: any) => {
    if (window.confirm(`هل أنت متأكد من حذف حساب الشركة (${tenant.name}) بشكل نهائي؟ سيتم مسح كافة البيانات ولن يمكن التراجع!`)) {
      try {
        await deleteTenant(tenant.id).unwrap();
        showToast(`تم حذف الشركة ${tenant.name} بنجاح`, 'success');
        refetch();
      } catch (err: any) {
        showToast(err?.data?.detail || 'حدث خطأ أثناء الحذف', 'error');
      }
    }
  };

  if (loadingOverview || loadingTenants) return <VegetableLoader text="لوحة التحكم المركزية – حَصَاد SaaS" fullScreen />;

  const filtered = (tenants || []).filter((t: any) =>
    t.name?.includes(search) || t.subdomain?.includes(search)
  );

  return (
    <div>
      {/* ── Page Title ── */}
      <div className="page-title">
        <div className="title-text">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#6366f1' }}></i>
            إدارة منظومة حَصَاد
            <span style={{
              fontSize: '11px', fontWeight: 700, background: '#6366f1', color: 'white',
              padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.05em',
            }}>SUPER ADMIN</span>
          </h2>
          <p>راقب العملاء، فعّل الحسابات، وادر الشركات المشتركة من مكان واحد</p>
        </div>
        <div className="title-actions">
          <button className="btn btn-ghost" onClick={() => refetch()}><i className="fa-solid fa-arrows-rotate"></i></button>
          <button
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', fontSize: '15px' }}
            onClick={() => setIsModalOpen(true)}
          >
            <i className="fa-solid fa-plus"></i> تفعيل شركة جديدة
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { icon: 'fa-building', label: 'إجمالي الشركات', val: overview?.total_tenants ?? 0, color: '#6366f1' },
          { icon: 'fa-circle-check', label: 'تراخيص نشطة', val: overview?.active_tenants ?? 0, color: '#059652' },
          { icon: 'fa-users', label: 'إجمالي المستخدمين', val: overview?.total_users ?? 0, color: '#0284c7' },
          { icon: 'fa-chart-bar', label: 'إجمالي الحركات', val: overview?.total_transactions ?? 0, color: '#d97706' },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>
              <i className={`fa-solid ${s.icon}`}></i>
            </div>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <span className="stat-value" style={{ color: s.color }}>{s.val.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Feed Grid ── */}
      <div className="content-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3><i className="fa-solid fa-chart-area" style={{ color: '#6366f1', marginLeft: '8px' }}></i> نمو العمليات في المنصة</h3>
            <span className="badge badge-success">+24% هذا الشهر</span>
          </div>
          <div className="card-body" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <defs>
                  <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', fontFamily: 'Cairo' }} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fill="url(#adminGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fa-solid fa-satellite-dish" style={{ color: '#dc2626', marginLeft: '8px' }}></i> بث مباشر للنشاط</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(tenants || []).slice(0, 5).map((t: any) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent:'center',
                  color: 'white', fontWeight: 900, fontSize: 14, flexShrink: 0,
                }}>{t.name?.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ping: 18ms • OK</div>
                </div>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: t.status === 'active' ? '#059652' : '#dc2626',
                  boxShadow: `0 0 6px ${t.status === 'active' ? '#059652' : '#dc2626'}`,
                }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tenants Table ── */}
      <div className="card">
        <div className="card-header">
          <h3><i className="fa-solid fa-database" style={{ color: '#6366f1', marginLeft: '8px' }}></i> قاعدة بيانات الشركات</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="search-bar" style={{ width: 260 }}>
              <i className="fa-solid fa-search"></i>
              <input
                type="text"
                placeholder="بحث باسم الشركة أو النطاق..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المكان / الشركة</th>
                  <th>النطاق السحابي</th>
                  <th>حالة النظام</th>
                  <th className="text-center">الإدارة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 800 }}>{t.name}</td>
                    <td dir="ltr" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t.subdomain}.hisbasys.com</td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {t.status === 'active' ? 'فعال ومتصل' : 'موقوف'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {/* Toggle button */}
                        <button
                          className="btn btn-sm"
                          title={t.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                          onClick={() => handleToggle(t)}
                          style={{
                            background: t.status === 'active' ? '#fee2e2' : '#dcfce7',
                            color: t.status === 'active' ? '#dc2626' : '#059652',
                            border: `1px solid ${t.status === 'active' ? '#fecaca' : '#bbf7d0'}`,
                          }}
                        >
                          <i className={`fa-solid ${t.status === 'active' ? 'fa-power-off' : 'fa-play'}`}></i>
                          {t.status === 'active' ? ' إيقاف' : ' تفعيل'}
                        </button>
                        {/* Manage users button */}
                        <button
                          className="btn btn-sm"
                          title="إدارة المستخدمين"
                          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                          onClick={() => showToast(`إدارة مستخدمي ${t.name} — قيد التطوير`, 'info')}
                        >
                          <i className="fa-solid fa-users-gear"></i> مستخدمون
                        </button>
                        {/* Delete button */}
                        <button
                          className="btn btn-sm"
                          title="حذف الشركة نهائياً"
                          style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                          onClick={() => handleDelete(t)}
                        >
                          <i className="fa-solid fa-trash-can"></i> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-building-slash" style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: 0.25 }}></i>
                      لا توجد شركات مسجلة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create Tenant Modal ── */}
      <div className={`modal ${isModalOpen ? 'show' : ''}`}>
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
        <div className="modal-box">
          <div className="modal-header" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: 'white', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
            <div>
              <div className="modal-title" style={{ color: 'white', fontSize: 22 }}>
                <i className="fa-solid fa-rocket" style={{ marginLeft: '10px', color: '#a5b4fc' }}></i>
                تجهيز مساحة عمل جديدة
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 4 }}>
                سيقوم حصاد بإنشاء قاعدة بيانات مخصصة للعميل الجديد فوراً
              </div>
            </div>
            <button className="modal-close" onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div className="form-group">
                  <label>الاسم التجاري للشركة <span className="required">*</span></label>
                  <input required className="form-control" placeholder="مثال: شركة الحرية للخضار" value={formData.tenant_name} onChange={e => setFormData({ ...formData, tenant_name: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>النطاق (Subdomain) <span className="required">*</span></label>
                    <input required className="form-control" dir="ltr" placeholder="example" value={formData.subdomain} onChange={e => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
                  </div>
                  <div className="form-group">
                    <label>اسم المستخدم (Admin) <span className="required">*</span></label>
                    <input required className="form-control" value={formData.owner_username} onChange={e => setFormData({ ...formData, owner_username: e.target.value })} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>كلمة المرور الابتدائية <span className="required">*</span></label>
                    <input required type="password" className="form-control" value={formData.owner_password} onChange={e => setFormData({ ...formData, owner_password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>نوع الصلاحية <span className="required">*</span></label>
                    <select className="form-control" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      <option value="owner">مدير عادي (Owner)</option>
                      <option value="accountant">محاسب</option>
                    </select>
                  </div>
                </div>

                {/* Warning about super_admin */}
                <div style={{
                  background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)',
                  padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }}></i>
                  <p style={{ fontSize: 13, color: '#92400e', margin: 0, fontWeight: 600 }}>
                    صلاحيات Super Admin محجوزة حصرياً لك. لا يمكن منحها عند إنشاء حسابات العملاء.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="submit" disabled={isCreating} className="btn btn-primary btn-lg" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', flex: 1 }}>
                {isCreating
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري بناء النظام...</>
                  : <><i className="fa-solid fa-rocket"></i> إنشاء وتفعيل النظام</>
                }
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
