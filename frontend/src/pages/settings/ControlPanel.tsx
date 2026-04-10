import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { useToast } from '../../components/ui/Toast';

/* ── Inject all control-panel API endpoints ── */
const cpApi = api.injectEndpoints({
  endpoints: (b) => ({
    // Currencies
    getCurrencies: b.query({ query: () => 'currencies/', providesTags: ['Currencies'] }),
    createCurrency: b.mutation({ query: (d) => ({ url: 'currencies/', method: 'POST', body: d }), invalidatesTags: ['Currencies'] }),
    updateCurrency: b.mutation({ query: ({ id, ...d }) => ({ url: `currencies/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['Currencies'] }),
    deleteCurrency: b.mutation({ query: (id) => ({ url: `currencies/${id}/`, method: 'DELETE' }), invalidatesTags: ['Currencies'] }),
    getExchangeRates: b.query({ query: () => 'exchange-rates/', providesTags: ['ExchangeRates'] }),
    createExchangeRate: b.mutation({ query: (d) => ({ url: 'exchange-rates/', method: 'POST', body: d }), invalidatesTags: ['ExchangeRates'] }),
    // Commission Types
    getCommissionTypes: b.query({ query: () => 'commission-types/', providesTags: ['CommissionTypes'] }),
    createCommissionType: b.mutation({ query: (d) => ({ url: 'commission-types/', method: 'POST', body: d }), invalidatesTags: ['CommissionTypes'] }),
    updateCommissionType: b.mutation({ query: ({ id, ...d }) => ({ url: `commission-types/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['CommissionTypes'] }),
    deleteCommissionType: b.mutation({ query: (id) => ({ url: `commission-types/${id}/`, method: 'DELETE' }), invalidatesTags: ['CommissionTypes'] }),
    // Users
    getUsers: b.query({ query: () => 'users/', providesTags: ['Users'] }),
    createUser: b.mutation({ query: (d) => ({ url: 'users/', method: 'POST', body: d }), invalidatesTags: ['Users'] }),
    updateUser: b.mutation({ query: ({ id, ...d }) => ({ url: `users/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['Users'] }),
    // Categories
    getCategories: b.query({ query: () => 'categories/', providesTags: ['Categories'] }),
    createCategory: b.mutation({ query: (d) => ({ url: 'categories/', method: 'POST', body: d }), invalidatesTags: ['Categories'] }),
    deleteCategory: b.mutation({ query: (id) => ({ url: `categories/${id}/`, method: 'DELETE' }), invalidatesTags: ['Categories'] }),
    // Account Groups (Chart of Accounts)
    getAccountGroups: b.query({ query: () => 'account-groups/', providesTags: ['AccountGroups'] }),
    createAccountGroup: b.mutation({ query: (d) => ({ url: 'account-groups/', method: 'POST', body: d }), invalidatesTags: ['AccountGroups'] }),
    updateAccountGroup: b.mutation({ query: ({ id, ...d }) => ({ url: `account-groups/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['AccountGroups'] }),
    deleteAccountGroup: b.mutation({ query: (id) => ({ url: `account-groups/${id}/`, method: 'DELETE' }), invalidatesTags: ['AccountGroups'] }),
    // Accounts
    getAccounts: b.query({ query: () => 'accounts/', providesTags: ['Accounts'] }),
    createAccount: b.mutation({ query: (d) => ({ url: 'accounts/', method: 'POST', body: d }), invalidatesTags: ['Accounts'] }),
    updateAccount: b.mutation({ query: ({ id, ...d }) => ({ url: `accounts/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['Accounts'] }),
    // Global Units
    getGlobalUnits: b.query({ query: () => 'global-units/', providesTags: ['GlobalUnits'] }),
    createGlobalUnit: b.mutation({ query: (d) => ({ url: 'global-units/', method: 'POST', body: d }), invalidatesTags: ['GlobalUnits'] }),
    updateGlobalUnit: b.mutation({ query: ({ id, ...d }) => ({ url: `global-units/${id}/`, method: 'PATCH', body: d }), invalidatesTags: ['GlobalUnits'] }),
    deleteGlobalUnit: b.mutation({ query: (id) => ({ url: `global-units/${id}/`, method: 'DELETE' }), invalidatesTags: ['GlobalUnits'] }),
  }),
  overrideExisting: false,
});

export const {
  useGetCurrenciesQuery, useCreateCurrencyMutation, useUpdateCurrencyMutation, useDeleteCurrencyMutation,
  useGetExchangeRatesQuery, useCreateExchangeRateMutation,
  useGetCommissionTypesQuery, useCreateCommissionTypeMutation, useUpdateCommissionTypeMutation, useDeleteCommissionTypeMutation,
  useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation,
  useGetCategoriesQuery, useCreateCategoryMutation, useDeleteCategoryMutation,
  useGetAccountGroupsQuery, useCreateAccountGroupMutation, useUpdateAccountGroupMutation, useDeleteAccountGroupMutation,
  useGetAccountsQuery, useCreateAccountMutation, useUpdateAccountMutation,
  useGetGlobalUnitsQuery, useCreateGlobalUnitMutation, useUpdateGlobalUnitMutation, useDeleteGlobalUnitMutation,
} = cpApi;

/* ── Sidebar tabs ── */
const TABS = [
  { id: 'currencies',   label: 'العملات وأسعار الصرف',   icon: 'fa-coins' },
  { id: 'commissions',  label: 'أنواع العمولة (كميسيون)', icon: 'fa-percent' },
  { id: 'users',        label: 'المستخدمون والصلاحيات',  icon: 'fa-users-gear' },
  { id: 'categories',   label: 'تصنيفات الأصناف',         icon: 'fa-tags' },
  { id: 'units',        label: 'الوحدات (الفوارغ)',        icon: 'fa-box' },
  { id: 'coa',          label: 'شجرة الحسابات',           icon: 'fa-sitemap' },
];

/* ════════════════════════════════════════════════════════════════════════════ */
export default function ControlPanel() {
  const [tab, setTab] = useState('currencies');

  return (
    <div style={{ display: 'flex', gap: '24px', direction: 'rtl', minHeight: '80vh' }}>
      {/* ── Left Sidebar ── */}
      <aside style={{
        width: '240px', background: 'white', borderRadius: '16px',
        border: '1px solid #e4e4e7', padding: '12px', flexShrink: 0,
        height: 'fit-content', position: 'sticky', top: 0,
      }}>
        <div style={{ fontWeight: 900, color: '#18181b', fontSize: '15px', padding: '8px 12px 16px', borderBottom: '1px solid #f4f4f5', marginBottom: '8px' }}>
          <i className="fa-solid fa-sliders" style={{ marginLeft: '8px', color: '#059669' }} />
          لوحة التحكم
        </div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            padding: '10px 12px', borderRadius: '10px', textAlign: 'right',
            fontWeight: 700, fontSize: '13px', marginBottom: '4px',
            background: tab === t.id ? '#f0fdf4' : 'transparent',
            color: tab === t.id ? '#059669' : '#52525b',
            border: tab === t.id ? '1px solid #bbf7d0' : '1px solid transparent',
            cursor: 'pointer',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ width: '18px', textAlign: 'center' }} />
            {t.label}
          </button>
        ))}
      </aside>

      {/* ── Main Content ── */}
      <div style={{ flex: 1 }}>
        {tab === 'currencies'  && <CurrenciesTab />}
        {tab === 'commissions' && <CommissionsTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'categories'  && <CategoriesTab />}
        {tab === 'units'       && <GlobalUnitsTab />}
        {tab === 'coa'         && <ChartOfAccountsTab />}
      </div>
    </div>
  );
}

/* ════════ TAB: Currencies & Exchange Rates ════════ */
function CurrenciesTab() {
  const { showToast } = useToast();
  const { data: currData } = useGetCurrenciesQuery({});
  const { data: ratesData } = useGetExchangeRatesQuery({});
  const [createCurrency] = useCreateCurrencyMutation();
  const [deleteCurrency] = useDeleteCurrencyMutation();
  const [createRate] = useCreateExchangeRateMutation();

  const currencies = currData?.results || (Array.isArray(currData) ? currData : []);
  const rates = ratesData?.results || (Array.isArray(ratesData) ? ratesData : []);

  const [newCur, setNewCur] = useState({ code: '', name: '', symbol: '' });
  const [newRate, setNewRate] = useState({ currency: '', rate: '', date: new Date().toISOString().split('T')[0] });

  const [updateCurrency] = useUpdateCurrencyMutation();

  const submitCurrency = async () => {
    try { await createCurrency(newCur).unwrap(); showToast('تمت الإضافة', 'success'); setNewCur({ code: '', name: '', symbol: '' }); }
    catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  const handleSetBase = async (id: string) => {
    if (!window.confirm('هل تريد تغيير العملة الأساسية؟')) return;
    try {
      await updateCurrency({ id, is_base: true }).unwrap();
      showToast('تم تغيير العملة الأساسية بنجاح', 'success');
    } catch {
      showToast('خطأ في العملية', 'error');
    }
  };

  const submitRate = async () => {
    try { await createRate(newRate).unwrap(); showToast('تم تسجيل سعر الصرف', 'success'); setNewRate({ currency: '', rate: '', date: newRate.date }); }
    catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionCard title="العملات المتاحة" icon="fa-coins">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ background: '#f4f4f5' }}>
            <tr>
              {['الكود', 'الاسم', 'الرمز', 'الحالة / أساسية', 'العمليات'].map(h => (
                <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currencies.map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '10px', fontWeight: 900, color: '#059669' }}>{c.code}</td>
                <td style={{ padding: '10px' }}>{c.name}</td>
                <td style={{ padding: '10px' }}>{c.symbol}</td>
                <td style={{ padding: '10px' }}>
                  {c.is_base ? 
                    <span style={{ color: '#059669', fontWeight: 900, background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>✓ عملة النظام الأساسية</span> 
                    : <span style={{ color: '#a1a1aa' }}>عملة فرعية</span>
                  }
                </td>
                <td style={{ padding: '10px', display: 'flex', gap: '12px' }}>
                  {!c.is_base && (
                    <>
                      <button onClick={() => handleSetBase(c.id)} style={{ color: '#0284c7', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 900, fontSize: '12px' }}>
                        <i className="fa-solid fa-star" style={{ marginLeft: '4px' }} />
                        تعيين كأساسية
                      </button>
                      <button onClick={() => deleteCurrency(c.id)} style={{ color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 900, fontSize: '12px' }}>حذف</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {/* Add Row */}
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '6px' }}><Field value={newCur.code} onChange={v => setNewCur(p => ({ ...p, code: v }))} placeholder="ILS" /></td>
              <td style={{ padding: '6px' }}><Field value={newCur.name} onChange={v => setNewCur(p => ({ ...p, name: v }))} placeholder="شيكل" /></td>
              <td style={{ padding: '6px' }}><Field value={newCur.symbol} onChange={v => setNewCur(p => ({ ...p, symbol: v }))} placeholder="₪" /></td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}>
                 سيتم تفعيلها كعملة فرعية
              </td>
              <td style={{ padding: '6px' }}>
                <GreenBtn onClick={submitCurrency}>إضافة عملة</GreenBtn>
              </td>
            </tr>
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="أسعار الصرف اليومية" icon="fa-chart-line">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', display: 'block', marginBottom: '4px' }}>العملة</label>
            <select value={newRate.currency} onChange={e => setNewRate(p => ({ ...p, currency: e.target.value }))}
              style={{ padding: '8px 12px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700 }}>
              <option value="">اختر عملة</option>
              {currencies.filter((c: any) => !c.is_base).map((c: any) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', display: 'block', marginBottom: '4px' }}>سعر الصرف (مقابل العملة الأساسية)</label>
            <Field value={newRate.rate} onChange={v => setNewRate(p => ({ ...p, rate: v }))} placeholder="3.850" type="number" />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', display: 'block', marginBottom: '4px' }}>التاريخ</label>
            <Field value={newRate.date} onChange={v => setNewRate(p => ({ ...p, date: v }))} type="date" />
          </div>
          <GreenBtn onClick={submitRate}>تسجيل</GreenBtn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f4f4f5' }}>
            <tr>
              {['التاريخ', 'العملة', 'سعر الصرف'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.slice(0, 20).map((r: any) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '8px' }}>{r.date}</td>
                <td style={{ padding: '8px', fontWeight: 900 }}>{r.currency_code || r.currency}</td>
                <td style={{ padding: '8px', color: '#059669', fontWeight: 900 }}>{r.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ════════ TAB: Commission Types ════════ */
function CommissionsTab() {
  const { showToast } = useToast();
  const { data } = useGetCommissionTypesQuery({});
  const [create] = useCreateCommissionTypeMutation();
  const [update] = useUpdateCommissionTypeMutation();
  const [remove] = useDeleteCommissionTypeMutation();
  const [form, setForm] = useState({ name: '', calc_type: 'percent', default_rate: '' });
  const [editing, setEditing] = useState<any>(null);
  const items = data?.results || (Array.isArray(data) ? data : []);

  const submit = async () => {
    try {
      if (editing) {
        await update({ id: editing.id, ...form }).unwrap();
        setEditing(null);
      } else {
        await create(form).unwrap();
      }
      showToast('تم الحفظ', 'success');
      setForm({ name: '', calc_type: 'percent', default_rate: '' });
    } catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  return (
    <SectionCard title="أنواع العمولة (كميسيون) — REQUIREMENT 2" icon="fa-percent">
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', color: '#065f46', fontWeight: 700, margin: '0 0 12px' }}>
          💡 تُطبَّق العمولة على المزارع (تُخصم من صافيه) وعلى الزبون (تُضاف لفاتورته). كل طرف له نوع عمولة مستقل.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>اسم نوع العمولة</label>
            <Field value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="مثال: عمولة مزارع 10%" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>طريقة الحساب</label>
            <select value={form.calc_type} onChange={e => setForm(p => ({ ...p, calc_type: e.target.value }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700 }}>
              <option value="percent">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{form.calc_type === 'percent' ? 'النسبة (%)' : 'المبلغ الثابت'}</label>
            <Field value={form.default_rate} onChange={v => setForm(p => ({ ...p, default_rate: v }))} type="number" placeholder="10" />
          </div>
          <GreenBtn onClick={submit}>{editing ? 'تحديث' : 'إضافة'}</GreenBtn>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: '', calc_type: 'percent', default_rate: '' }); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e4e4e7', cursor: 'pointer', fontWeight: 700, color: '#71717a' }}>إلغاء</button>}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead style={{ background: '#f4f4f5' }}>
          <tr>
            {['الاسم', 'نوع الحساب', 'القيمة/النسبة', ''].map(h => (
              <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
              <td style={{ padding: '10px', fontWeight: 900 }}>{item.name}</td>
              <td style={{ padding: '10px' }}>{item.calc_type === 'percent' ? 'نسبة %' : 'مبلغ ثابت'}</td>
              <td style={{ padding: '10px', color: '#059669', fontWeight: 900, direction: 'ltr' }}>
                {item.default_rate}{item.calc_type === 'percent' ? '%' : ' ₪'}
              </td>
              <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                <button onClick={() => { setEditing(item); setForm({ name: item.name, calc_type: item.calc_type, default_rate: item.default_rate }); }} style={{ color: '#3b82f6', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 900 }}>تعديل</button>
                <button onClick={async () => { try { await remove(item.id).unwrap(); showToast('تم الحذف', 'success'); } catch { showToast('لا يمكن الحذف (مستخدم)', 'error'); } }} style={{ color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 900 }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

/* ════════ TAB: Users & Permissions ════════ */
function UsersTab() {
  const { showToast } = useToast();
  const { data } = useGetUsersQuery({});
  const [create] = useCreateUserMutation();
  const [update] = useUpdateUserMutation();
  const [form, setForm] = useState({ 
    username: '', password: '', role: 'cashier', first_name: '',
    permissions: [] as string[]
  });
  const users = data?.results || (Array.isArray(data) ? data : []);

  const PERMS = [
    { id: 'pos', label: 'كاشير / ميزان' },
    { id: 'shipments', label: 'الشحنات والكميات' },
    { id: 'suppliers', label: 'المزارعين والذمم' },
    { id: 'customers', label: 'التجار والزبائن' },
    { id: 'finance', label: 'السندات والمالية (قبض/صرف)' },
    { id: 'reports', label: 'التقارير والميزانية' },
    { id: 'hr', label: 'الموظفين والرواتب' },
    { id: 'settings', label: 'إعدادات النظام' },
  ];

  const togglePerm = (id: string) => {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(id) 
        ? p.permissions.filter(x => x !== id)
        : [...p.permissions, id]
    }));
  };

  const submit = async () => {
    try {
      await create(form).unwrap();
      showToast('تم إنشاء المستخدم', 'success');
      setForm({ username: '', password: '', role: 'cashier', first_name: '', permissions: [] });
    } catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  const ROLES: Record<string, string> = {
    'super_admin': '🔐 مدير النظام',
    'owner': '👑 صاحب المحل',
    'cashier': '💼 كاشير',
  };

  return (
    <SectionCard title="المستخدمون والصلاحيات" icon="fa-users-gear">
      <div style={{ background: '#f8f8f8', padding: '24px', borderRadius: '16px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 900 }}>إضافة مستخدم جديد</h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={labelStyle}>اسم المستخدم</label>
            <Field value={form.username} onChange={v => setForm(p => ({ ...p, username: v }))} placeholder="user123" />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={labelStyle}>الاسم الكامل</label>
            <Field value={form.first_name} onChange={v => setForm(p => ({ ...p, first_name: v }))} placeholder="أحمد محمود" />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={labelStyle}>كلمة المرور</label>
            <Field value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} type="password" placeholder="••••••••" />
          </div>
          <div style={{ minWidth: '150px' }}>
            <label style={labelStyle}>الدور الأساسي</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700 }}>
              <option value="cashier">كاشير</option>
              <option value="owner">صاحب المحل</option>
              <option value="super_admin">مدير النظام</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
           <label style={labelStyle}>صلاحيات إضافية محددة</label>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
              {PERMS.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e4e4e7' }}>
                   <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                   {p.label}
                </label>
              ))}
           </div>
        </div>

        <div style={{ textAlign: 'left' }}>
           <GreenBtn onClick={submit}>إضافة مستخدم</GreenBtn>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead style={{ background: '#f4f4f5' }}>
          <tr>{['المستخدم', 'الاسم', 'الصلاحيات المتاحة', 'نشط', ''].map(h => (
            <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
              <td style={{ padding: '10px', fontWeight: 900, fontFamily: 'monospace' }}>{u.username}</td>
              <td style={{ padding: '10px' }}>{u.first_name} {u.last_name}</td>
              <td style={{ padding: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ background: u.role === 'owner' ? '#fef3c7' : u.role === 'super_admin' ? '#fee2e2' : '#f0fdf4', color: u.role === 'owner' ? '#92400e' : u.role === 'super_admin' ? '#991b1b' : '#065f46', padding: '2px 8px', borderRadius: '12px', fontWeight: 900, fontSize: '10px' }}>
                    {ROLES[u.role] || u.role}
                    </span>
                    {(u.permissions || []).map((pId: string) => (
                        <span key={pId} style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '10px' }}>
                            {PERMS.find(x => x.id === pId)?.label || pId}
                        </span>
                    ))}
                </div>
              </td>
              <td style={{ padding: '10px' }}>{u.is_active ? '✓' : '✗'}</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => update({ id: u.id, is_active: !u.is_active })} style={{ color: u.is_active ? '#ef4444' : '#059669', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 900, fontSize: '12px' }}>
                  {u.is_active ? 'تعطيل' : 'تفعيل'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

/* ════════ TAB: Item Categories ════════ */
function CategoriesTab() {
  const { showToast } = useToast();
  const { data } = useGetCategoriesQuery({});
  const [create] = useCreateCategoryMutation();
  const [remove] = useDeleteCategoryMutation();
  const [name, setName] = useState('');
  const items = data?.results || (Array.isArray(data) ? data : []);

  const submit = async () => {
    if (!name.trim()) return;
    try { await create({ name }).unwrap(); showToast('تمت الإضافة', 'success'); setName(''); }
    catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  return (
    <SectionCard title="تصنيفات الأصناف" icon="fa-tags">
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>اسم التصنيف</label>
          <Field value={name} onChange={setName} placeholder="مثال: خضراوات ورقية" />
        </div>
        <GreenBtn onClick={submit}>إضافة</GreenBtn>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {items.map((item: any) => (
          <div key={item.id} style={{ background: '#f4f4f5', borderRadius: '20px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '13px' }}>
            {item.name}
            <button onClick={async () => { try { await remove(item.id).unwrap(); } catch { showToast('لا يمكن الحذف — يحتوي على بيانات', 'error'); } }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900 }}>✕</button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ════════ TAB: Chart of Accounts (شجرة الحسابات) ════════ */
function ChartOfAccountsTab() {
  const { showToast } = useToast();
  const { data: groupsData } = useGetAccountGroupsQuery({});
  const { data: accountsData } = useGetAccountsQuery({});
  const [createGroup] = useCreateAccountGroupMutation();
  const [createAccount] = useCreateAccountMutation();

  const groups = groupsData?.results || (Array.isArray(groupsData) ? groupsData : []);
  const accounts = accountsData?.results || (Array.isArray(accountsData) ? accountsData : []);

  const [gForm, setGForm] = useState({ name: '', code: '', account_type: 'asset', parent: '' });
  const [aForm, setAForm] = useState({ name: '', code: '', group: '', is_active: true });

  const ACCOUNT_TYPES = [
    { value: 'asset', label: 'أصول' },
    { value: 'liability', label: 'خصوم' },
    { value: 'equity', label: 'حقوق ملكية' },
    { value: 'revenue', label: 'إيرادات' },
    { value: 'expense', label: 'مصروفات' },
  ];
  const TYPE_COLORS: Record<string, string> = { asset: '#3b82f6', liability: '#ef4444', equity: '#8b5cf6', revenue: '#059669', expense: '#f59e0b' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionCard title="مجموعات الحسابات (الشجرة الرئيسية)" icon="fa-sitemap">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px', background: '#f8f8f8', padding: '16px', borderRadius: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>اسم المجموعة</label>
            <Field value={gForm.name} onChange={v => setGForm(p => ({ ...p, name: v }))} placeholder="مثال: 1 — الأصول الجارية" />
          </div>
          <div>
            <label style={labelStyle}>الكود</label>
            <Field value={gForm.code} onChange={v => setGForm(p => ({ ...p, code: v }))} placeholder="1000" />
          </div>
          <div>
            <label style={labelStyle}>النوع</label>
            <select value={gForm.account_type} onChange={e => setGForm(p => ({ ...p, account_type: e.target.value }))}
              style={{ padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700 }}>
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>المجموعة الأب (اختياري)</label>
            <select value={gForm.parent} onChange={e => setGForm(p => ({ ...p, parent: e.target.value }))}
              style={{ padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700, minWidth: '160px' }}>
              <option value="">بدون (مجموعة رئيسية)</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <GreenBtn onClick={async () => {
            try { await createGroup({ ...gForm, parent: gForm.parent || null }).unwrap(); showToast('تمت إضافة المجموعة', 'success'); setGForm({ name: '', code: '', account_type: 'asset', parent: '' }); }
            catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
          }}>إضافة مجموعة</GreenBtn>
        </div>
        {/* Groups tree */}
        <div>
          {ACCOUNT_TYPES.map(type => {
            const typeGroups = groups.filter((g: any) => g.account_type === type.value);
            if (!typeGroups.length) return null;
            return (
              <div key={type.value} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 900, color: TYPE_COLORS[type.value], marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: TYPE_COLORS[type.value], color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px' }}>{type.label}</span>
                </div>
                {typeGroups.map((g: any) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: g.parent ? '#fafafa' : '#f0fdf4', borderRadius: '8px', marginBottom: '4px', paddingRight: g.parent ? '28px' : '12px', border: '1px solid #e4e4e7' }}>
                    {g.parent && <span style={{ color: '#d4d4d8', fontSize: '16px' }}>└</span>}
                    <span style={{ fontWeight: 900, color: '#18181b', fontSize: '13px' }}>{g.code}</span>
                    <span style={{ color: '#52525b', fontSize: '13px' }}>{g.name}</span>
                    <span style={{ marginRight: 'auto', fontSize: '11px', color: '#a1a1aa' }}>{accounts.filter((a: any) => a.group === g.id).length} حساب</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="الحسابات الفرعية (دفتر الأستاذ)" icon="fa-book">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px', background: '#f8f8f8', padding: '16px', borderRadius: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>اسم الحساب</label>
            <Field value={aForm.name} onChange={v => setAForm(p => ({ ...p, name: v }))} placeholder="مثال: صندوق النقدية" />
          </div>
          <div>
            <label style={labelStyle}>الكود</label>
            <Field value={aForm.code} onChange={v => setAForm(p => ({ ...p, code: v }))} placeholder="1001" />
          </div>
          <div>
            <label style={labelStyle}>المجموعة</label>
            <select value={aForm.group} onChange={e => setAForm(p => ({ ...p, group: e.target.value }))}
              style={{ padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700, minWidth: '180px' }}>
              <option value="">اختر مجموعة</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <GreenBtn onClick={async () => {
            if (!aForm.group) { showToast('اختر مجموعة أولاً', 'error'); return; }
            try { await createAccount(aForm).unwrap(); showToast('تمت إضافة الحساب', 'success'); setAForm({ name: '', code: '', group: aForm.group, is_active: true }); }
            catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
          }}>إضافة حساب</GreenBtn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f4f4f5' }}>
            <tr>{['الكود', 'اسم الحساب', 'المجموعة', 'نشط'].map(h => (
              <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {accounts.map((a: any) => {
              const grp = groups.find((g: any) => g.id === a.group);
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                  <td style={{ padding: '8px', fontWeight: 900, fontFamily: 'monospace', color: '#059669' }}>{a.code}</td>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{a.name}</td>
                  <td style={{ padding: '8px', color: '#71717a', fontSize: '12px' }}>{grp ? `${grp.code} — ${grp.name}` : '—'}</td>
                  <td style={{ padding: '8px' }}>{a.is_active ? <span style={{ color: '#059669' }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ── Shared tiny components ── */
const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#71717a', display: 'block', marginBottom: '4px' };

function Field({ value, onChange, placeholder = '', type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '10px 12px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700, fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
    />
  );
}

function GreenBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ background: '#059669', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, fontSize: '13px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {children}
    </button>
  );
}

function GlobalUnitsTab() {
  const { showToast } = useToast();
  const { data } = useGetGlobalUnitsQuery({});
  const [create] = useCreateGlobalUnitMutation();
  const [remove] = useDeleteGlobalUnitMutation();
  const [form, setForm] = useState({ name: '', has_empties: false });
  const items = data?.results || (Array.isArray(data) ? data : []);

  const submit = async () => {
    if (!form.name.trim()) return;
    try { await create(form).unwrap(); showToast('تمت الإضافة', 'success'); setForm({ name: '', has_empties: false }); }
    catch (e: any) { showToast(JSON.stringify(e?.data || 'خطأ'), 'error'); }
  };

  return (
    <SectionCard title="إدارة الوحدات (صندوق، شوال، إلخ)" icon="fa-box">
      <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#166534', margin: '0 0 12px' }}>
          💡 الوحدات التي يتم تفعيل خيار "فوارغ" بها، سيقوم النظام تلقائياً بتفعيل خيار "يوجد فوارغ" في شاشة البيع عند اختيارها.
        </p>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>اسم الوحدة</label>
            <Field value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="مثال: صندوق خشب" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px' }}>
            <input type="checkbox" checked={form.has_empties} onChange={e => setForm(p => ({ ...p, has_empties: e.target.checked }))} style={{ width: '18px', height: '18px' }} id="has_empties_chk" />
            <label htmlFor="has_empties_chk" style={{ fontSize: '13px', fontWeight: 700, color: '#374151', cursor: 'pointer' }}>بها فوارغ (تسترجع)؟</label>
          </div>
          <GreenBtn onClick={submit}>إضافة وحدة</GreenBtn>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead style={{ background: '#f4f4f5' }}>
          <tr>
            {['الاسم', 'يتطلب فوارغ', ''].map(h => (
              <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
              <td style={{ padding: '10px', fontWeight: 900 }}>{item.name}</td>
              <td style={{ padding: '10px' }}>{item.has_empties ? <span style={{ color: '#059669', fontWeight: 900 }}>✓ نعم</span> : <span style={{ color: '#ef4444' }}>✗ لا</span>}</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => remove(item.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900 }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e4e4e7', padding: '24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#18181b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className={`fa-solid ${icon}`} style={{ color: '#059669' }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

