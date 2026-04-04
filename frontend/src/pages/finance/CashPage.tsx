import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { TableSkeleton } from '../../components/Skeleton';

const cashApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCashBalance: build.query({
      query: () => 'finance/cash/balance/',
      providesTags: ['Cash'],
    }),
    getCashTransactions: build.query({
      query: () => 'finance/cash/',
      providesTags: ['Cash'],
    }),
    createCashTransaction: build.mutation({
      query: (body) => ({
        url: 'finance/cash/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Cash'],
    }),
  }),
});

export const { useGetCashBalanceQuery, useGetCashTransactionsQuery, useCreateCashTransactionMutation } = cashApi;

export default function CashPage() {
  const { data: balanceData, isLoading: loadingBalance } = useGetCashBalanceQuery({});
  const { data: transactions, isLoading: loadingTx } = useGetCashTransactionsQuery({});
  const [createTx] = useCreateCashTransactionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tx_type: 'in',
    amount: '',
    reference_type: 'manual',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTx({
        ...formData,
        amount: parseFloat(formData.amount)
      }).unwrap();
      setIsModalOpen(false);
      setFormData({ tx_type: 'in', amount: '', reference_type: 'manual', description: '' });
      alert('تم تسجيل الحركة بنجاح');
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  const getReferenceLabel = (type: string) => {
    const labels: Record<string, string> = {
      sale: 'بيع نقدي',
      credit_sale: 'بيع آجل',
      settlement: 'تصفية مورد',
      expense: 'مصروفات',
      manual: 'حركة يدوية (سند)',
      collection: 'تحصيل (دفعة)',
    };
    return labels[type] || type;
  };

  if (loadingBalance || loadingTx) return <TableSkeleton titleWidth="260px" rows={7} columns={5} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2><Wallet style={{ display: 'inline', marginLeft: '0.5rem' }} /> الخزينة وحركة الأموال</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { setFormData({...formData, tx_type: 'in'}); setIsModalOpen(true); }} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
            <ArrowDownToLine size={18} /> سند إيداع / قبض
          </button>
          <button className="btn btn-secondary" onClick={() => { setFormData({...formData, tx_type: 'out'}); setIsModalOpen(true); }} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <ArrowUpFromLine size={18} /> سند صرف / دفع
          </button>
        </div>
      </div>

      {/* Balance Summary Header */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ flex: 1, backgroundColor: 'var(--primary-color)', color: 'white' }}>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>رصيد الخزينة الحالي</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem' }}>{balanceData?.balance?.toFixed(2) || '0.00'} ج</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>إجمالي الوارد</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.5rem' }}>{balanceData?.total_in?.toFixed(2) || '0.00'} ج</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>إجمالي المنصرف</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.5rem' }}>{balanceData?.total_out?.toFixed(2) || '0.00'} ج</div>
        </div>
      </div>

      <div className="card">
        <h3>سجل الحركة (كشف حساب الخزينة)</h3>
        <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <th style={{ padding: '1rem' }}>التاريخ</th>
              <th style={{ padding: '1rem' }}>النوع</th>
              <th style={{ padding: '1rem' }}>المبلغ</th>
              <th style={{ padding: '1rem' }}>البيان</th>
              <th style={{ padding: '1rem' }}>المرجع</th>
            </tr>
          </thead>
          <tbody>
            {(transactions || []).map((tx: any) => (
              <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', direction: 'ltr' }}>{new Date(tx.tx_date).toLocaleString('ar-EG')}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold',
                    backgroundColor: tx.tx_type === 'in' ? '#dcfce7' : '#fee2e2',
                    color: tx.tx_type === 'in' ? '#166534' : '#991b1b'
                  }}>
                    {tx.tx_type === 'in' ? 'وارد (إيداع)' : 'منصرف (دفع)'}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{parseFloat(tx.amount).toFixed(2)} ج</td>
                <td style={{ padding: '1rem' }}>{tx.description}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  {getReferenceLabel(tx.reference_type)} {tx.reference_id ? `#${tx.reference_id}` : ''}
                </td>
              </tr>
            ))}
            {(!transactions || transactions.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  لا توجد حركات في الخزينة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '400px', backgroundColor: 'var(--surface-color)' }}>
            <h3>تسجيل سند {formData.tx_type === 'in' ? 'إيداع (قبض)' : 'صرف (دفع)'}</h3>
            <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">المبلغ</label>
                <input type="number" step="0.01" className="form-input" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">سبب الحركة</label>
                <select className="form-input" value={formData.reference_type} onChange={e => setFormData({...formData, reference_type: e.target.value})}>
                  <option value="manual">أخرى (إيداع/سحب يدوي)</option>
                  {formData.tx_type === 'in' ? (
                    <option value="collection">تحصيل من عميل (سداد مديونية)</option>
                  ) : null}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">البيان والتفاصيل</label>
                <input className="form-input" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{flex: 1}}>اعتماد السند</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
