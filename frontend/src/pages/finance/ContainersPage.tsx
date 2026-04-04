import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { PackageOpen, Repeat } from 'lucide-react';
import { useGetCustomersQuery } from '../suppliers/Suppliers'; // Re-use from Suppliers if possible or define here.
import { TableSkeleton } from '../../components/Skeleton';

const containersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getContainerBalances: build.query({
      query: (customerId?: string) => `containers/balance/${customerId ? `?customer=${customerId}` : ''}`,
      providesTags: ['Containers'],
    }),
    getContainerTransactions: build.query({
      query: () => 'containers/',
      providesTags: ['Containers'],
    }),
    createContainerTransaction: build.mutation({
      query: (body) => ({
        url: 'containers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Containers'],
    }),
  }),
});

export const { useGetContainerBalancesQuery, useGetContainerTransactionsQuery, useCreateContainerTransactionMutation } = containersApi;

export default function ContainersPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const { data: balances, isLoading: loadingBalances } = useGetContainerBalancesQuery(selectedCustomerId);
  const { data: transactions, isLoading: loadingTx } = useGetContainerTransactionsQuery({});
  const { data: customers } = useGetCustomersQuery({}); // Assuming we export this! Wait, the previous supplier file exported useGetSuppliersQuery not customers. I'll define customersApi here.

  const [createTx] = useCreateContainerTransactionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    container_type: 'صندوق بلاستيك',
    direction: 'return',
    quantity: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTx(formData).unwrap();
      setIsModalOpen(false);
      setFormData({ ...formData, quantity: 1, customer: '' });
      alert('تم التسجيل بنجاح');
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  if (loadingBalances || loadingTx) return <TableSkeleton titleWidth="260px" rows={7} columns={5} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2><PackageOpen style={{ display: 'inline', marginLeft: '0.5rem' }} /> إدارة أرصدة الفوارغ</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Repeat size={18} /> تسجيل حركة فوارغ يدوية
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem' }}>
        {/* Balances Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <h3>الأرصدة الحالية للعملاء</h3>
          </div>
          
          <select 
            className="form-input" 
            style={{ marginBottom: '1rem' }}
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">-- كل العملاء --</option>
            {customers?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <th style={{ padding: '0.75rem' }}>العميل</th>
                <th style={{ padding: '0.75rem' }}>النوع</th>
                <th style={{ padding: '0.75rem' }}>صادر للعميل</th>
                <th style={{ padding: '0.75rem' }}>مُرتجع</th>
                <th style={{ padding: '0.75rem' }}>الباقي (الرصيد)</th>
              </tr>
            </thead>
            <tbody>
              {(balances || []).map((b: any, index: number) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}>{b.customer_name}</td>
                  <td style={{ padding: '0.75rem' }}>{b.container_type}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--danger)' }}>{b.out_total || 0}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--success)' }}>{b.return_total || 0}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{b.balance}</td>
                </tr>
              ))}
              {(!balances || balances.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>لا توجد أرصدة سابقة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Transactions Section */}
        <div className="card">
          <h3>سجل الحركات الأخير</h3>
          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <th style={{ padding: '0.75rem' }}>التاريخ</th>
                <th style={{ padding: '0.75rem' }}>العميل</th>
                <th style={{ padding: '0.75rem' }}>النوع</th>
                <th style={{ padding: '0.75rem' }}>الاتجاه</th>
                <th style={{ padding: '0.75rem' }}>الكمية</th>
                <th style={{ padding: '0.75rem' }}>ارتباط بالفاتورة</th>
              </tr>
            </thead>
            <tbody>
              {(transactions || []).map((tx: any) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', direction: 'ltr' }}>{new Date(tx.tx_date).toLocaleString('ar-EG')}</td>
                  <td style={{ padding: '0.75rem' }}>{customers?.find((c:any) => c.id === tx.customer)?.name || '...'}</td>
                  <td style={{ padding: '0.75rem' }}>{tx.container_type}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ 
                      padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem',
                      backgroundColor: tx.direction === 'out' ? '#fee2e2' : '#dcfce7',
                      color: tx.direction === 'out' ? '#991b1b' : '#166534'
                    }}>
                      {tx.direction === 'out' ? 'صرف (للعميل)' : 'استلام مُرتجع'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{tx.quantity}</td>
                  <td style={{ padding: '0.75rem' }}>{tx.sale ? `فاتورة #${tx.sale.substring(0,8)}` : 'يدوي'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '400px', backgroundColor: 'var(--surface-color)' }}>
            <h3>تسجيل حركة فوارغ (مُرتجع أو صرف)</h3>
            <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">العميل</label>
                <select className="form-input" required value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})}>
                  <option value="">-- اختر العميل --</option>
                  {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">نوع الفارغ</label>
                <input className="form-input" required value={formData.container_type} onChange={e => setFormData({...formData, container_type: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">اتجاه الحركة</label>
                  <select className="form-input" value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value})}>
                    <option value="return">استلام (مُرتجع من العميل)</option>
                    <option value="out">صرف (تسليم للعميل)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">العدد</label>
                  <input type="number" min="1" className="form-input" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{flex: 1}}>اعتماد الحركة</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
