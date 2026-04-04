import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { Receipt, Plus } from 'lucide-react';
import { useGetShipmentsQuery } from '../shipments/Shipments';
import { TableSkeleton } from '../../components/Skeleton';

const expensesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query({
      query: () => 'expenses/',
      providesTags: ['Expenses'],
    }),
    createExpense: build.mutation({
      query: (body) => ({
        url: 'expenses/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Expenses'],
    }),
  }),
});

export const { useGetExpensesQuery, useCreateExpenseMutation } = expensesApi;

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useGetExpensesQuery({});
  const { data: shipments } = useGetShipmentsQuery({});
  const [createExpense] = useCreateExpenseMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    expense_type: 'misc',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    shipment: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createExpense({
        ...formData,
        shipment: formData.shipment || null,
        amount: parseFloat(formData.amount)
      }).unwrap();
      setIsModalOpen(false);
      setFormData({
        expense_type: 'misc', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], shipment: ''
      });
      alert('تم التسجيل بنجاح');
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  const getExpenseLabel = (type: string) => {
    const labels: Record<string, string> = {
      transport: 'نقل ونولون',
      loading: 'تنزيل وتحميل',
      labor: 'عمالة',
      misc: 'أخرى (نثريات)'
    };
    return labels[type] || type;
  };

  if (isLoading) return <TableSkeleton titleWidth="240px" rows={7} columns={5} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2><Receipt style={{ display: 'inline', marginLeft: '0.5rem' }} /> المصروفات والمنصرف</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> تسجيل مصروف جديد
        </button>
      </div>

      <div className="card">
        <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <th style={{ padding: '1rem' }}>التاريخ</th>
              <th style={{ padding: '1rem' }}>النوع</th>
              <th style={{ padding: '1rem' }}>المبلغ</th>
              <th style={{ padding: '1rem' }}>البيان / الوصف</th>
              <th style={{ padding: '1rem' }}>مرتبط بإرسالية</th>
            </tr>
          </thead>
          <tbody>
            {(expenses || []).map((exp: any) => (
              <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', direction: 'ltr' }}>{exp.expense_date}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem',
                    backgroundColor: 'rgba(0,0,0,0.05)'
                  }}>
                    {getExpenseLabel(exp.expense_type)}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--danger)' }}>{parseFloat(exp.amount).toFixed(2)} ج</td>
                <td style={{ padding: '1rem' }}>{exp.description || '-'}</td>
                <td style={{ padding: '1rem' }}>
                  {exp.shipment ? (
                    <span style={{color: 'var(--primary-color)'}}>إرسالية #{exp.shipment.substring(0,8)}</span>
                  ) : (
                    <span style={{color: 'var(--text-muted)'}}>عام</span>
                  )}
                </td>
              </tr>
            ))}
            {(!expenses || expenses.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  لا توجد مصروفات مسجلة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '450px', backgroundColor: 'var(--surface-color)' }}>
            <h3>تسجيل مصروف</h3>
            <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">المبلغ</label>
                  <input type="number" step="0.01" className="form-input" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">التاريخ</label>
                  <input type="date" className="form-input" required value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">نوع المصروف</label>
                <select className="form-input" required value={formData.expense_type} onChange={e => setFormData({...formData, expense_type: e.target.value})}>
                  <option value="transport">نقل ونولون (سيارات)</option>
                  <option value="loading">تنزيل وتحميل للوكالة</option>
                  <option value="labor">عمالة</option>
                  <option value="misc">مصاريف أخرى (ضيافة، إلخ)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">تحميل على إرسالية معينة؟ (اختياري)</label>
                <select className="form-input" value={formData.shipment} onChange={e => setFormData({...formData, shipment: e.target.value})}>
                  <option value="">بدون إضافة لإرسالية (مصروف عام)</option>
                  {shipments?.filter((s:any) => s.status === 'open').map((s: any) => (
                    <option key={s.id} value={s.id}>
                      إرسالية المورد {s.supplier_name} - بتاريخ {s.shipment_date}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">البيان / الوصف</label>
                <input className="form-input" placeholder="مثال: حساب سيارة ربع نقل..." required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{flex: 1}}>اعتماد المصروف</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
