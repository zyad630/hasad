import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { Plus, Power } from 'lucide-react';
import { TableSkeleton } from '../../components/Skeleton';

const tenantApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTenants: build.query({
      query: () => 'tenants/',
      providesTags: ['Tenants'],
    }),
    createTenant: build.mutation({
      query: (body) => ({
        url: 'auth/register-tenant/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tenants'],
    }),
    updateTenantStatus: build.mutation({
      query: ({ id, status }) => ({
        url: `tenants/${id}/`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Tenants'],
    })
  })
});

const { useGetTenantsQuery, useCreateTenantMutation, useUpdateTenantStatusMutation } = tenantApi;

const TenantsList = () => {
  const { showToast } = useToast();
  const { data: tenants, isLoading } = useGetTenantsQuery({});
  const [createTenant] = useCreateTenantMutation();
  const [updateStatus] = useUpdateTenantStatusMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tenant_name: '', subdomain: '', owner_username: '', owner_password: ''
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTenant(formData).unwrap();
      setIsModalOpen(false);
      setFormData({tenant_name: '', subdomain: '', owner_username: '', owner_password: ''});
    } catch(err) {
      showToast('خطأ في التسجيل، تأكد من البيانات', 'error');
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="280px" rows={7} columns={5} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2>لوحة Super Admin - العملاء (Tenants)</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> عميل جديد (Trial)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card"><h3>العدد الكلي</h3><p style={{fontSize: '2rem'}}>{tenants?.length || 0}</p></div>
        <div className="card"><h3>النشطين (Active)</h3><p style={{fontSize: '2rem'}}>{tenants?.filter((t:any) => t.status==='active').length || 0}</p></div>
        <div className="card"><h3>في فترة التجربة (Trial)</h3><p style={{fontSize: '2rem'}}>{tenants?.filter((t:any) => t.status==='trial').length || 0}</p></div>
      </div>

      <div className="card">
        <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem' }}>الاسم</th>
              <th style={{ padding: '1rem' }}>Subdomain</th>
              <th style={{ padding: '1rem' }}>الحالة</th>
              <th style={{ padding: '1rem' }}>نهاية التجربة</th>
              <th style={{ padding: '1rem' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tenants?.map((t: any) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem' }}>{t.name}</td>
                <td style={{ padding: '1rem', direction: 'ltr' }}>{t.subdomain}.hisba.com</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem',
                    backgroundColor: t.status === 'active' ? '#dcfce7' : t.status === 'trial' ? '#fef3c7' : '#fee2e2',
                    color: t.status === 'active' ? '#166534' : t.status === 'trial' ? '#92400e' : '#991b1b'
                  }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ padding: '1rem', direction: 'ltr' }}>{new Date(t.trial_ends_at).toLocaleDateString('en-GB')}</td>
                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => updateStatus({id: t.id, status: t.status === 'active' ? 'suspended' : 'active'})}>
                    <Power size={16} /> {t.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
            {(!tenants || tenants.length === 0) && (
              <tr><td colSpan={5} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>لا يوجد عملاء حالياً</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '400px', backgroundColor: 'var(--surface-color)' }}>
            <h3>عميل جديد (Trial 14 Days)</h3>
            <form onSubmit={handleCreate} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">اسم المحل / الشركة</label>
                <input className="form-input" required value={formData.tenant_name} onChange={e => setFormData({...formData, tenant_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Subdomain (رابط الدخول المخصص)</label>
                <input className="form-input" required style={{direction: 'ltr'}} value={formData.subdomain} onChange={e => setFormData({...formData, subdomain: e.target.value})} placeholder="example" />
              </div>
              <div className="form-group">
                <label className="form-label">اسم مستخدم مالك النظام (Owner)</label>
                <input className="form-input" required value={formData.owner_username} onChange={e => setFormData({...formData, owner_username: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">كلمة المرور</label>
                <input className="form-input" type="password" required value={formData.owner_password} onChange={e => setFormData({...formData, owner_password: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{flex: 1}}>تسجيل وإطلاق Trial</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsList;
