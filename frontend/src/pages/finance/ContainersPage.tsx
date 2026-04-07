import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { useGetCustomersQuery } from '../suppliers/Customers';
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
  const { showToast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const { data: balances, isLoading: loadingBalances } = useGetContainerBalancesQuery(selectedCustomerId);
  const { data: transactions, isLoading: loadingTx } = useGetContainerTransactionsQuery({});
  const { data: customers } = useGetCustomersQuery({}); 

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
      showToast('تم التسجيل بنجاح', 'success');
    } catch (err) {
      showToast('حدث خطأ في العملية', 'error');
    }
  };

  if (loadingBalances || loadingTx) return <TableSkeleton titleWidth="260px" rows={7} columns={5} />;

  return (
    <div>
      {/* ── Page Title ── */}
      <div className="page-title">
        <div className="title-text">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <i className="fa-solid fa-box-open" style={{ color: 'var(--primary)' }}></i> 
             إدارة أرصدة الفوارغ
          </h2>
          <p>متابعة الصناديق البلاستيكية ومطالبات المزارعين والتجار</p>
        </div>
        <div className="title-actions">
           <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
             <i className="fa-solid fa-retweet"></i> تسجيل حركة فوارغ يدوية
           </button>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: 'minmax(400px, 1fr) 1.5fr' }}>
        
        {/* Balances Section */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3><i className="fa-solid fa-scale-balanced" style={{ color: 'var(--primary)', marginLeft: '6px' }}></i> الأرصدة الحالية للزبائن والتجار</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '14px' }}>
                <select 
                className="form-control" 
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                <option value="">-- عرض كل الزبائن --</option>
                {customers?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                </select>
            </div>
            
            <div className="table-wrapper">
                <table className="data-table text-center">
                <thead>
                    <tr>
                    <th className="text-right">الزبون / تاجر</th>
                    <th>النوع</th>
                    <th>صادر للزبون</th>
                    <th>مُرتجع</th>
                    <th>الباقي (الرصيد)</th>
                    </tr>
                </thead>
                <tbody>
                    {(balances || []).map((b: any, index: number) => (
                    <tr key={index}>
                        <td className="text-right" style={{ fontWeight: 800 }}>{b.customer_name}</td>
                        <td>{b.container_type}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 800 }} dir="ltr">{b.out_total || 0}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 800 }} dir="ltr">{b.return_total || 0}</td>
                        <td>
                            <span className="badge badge-purple" style={{ fontSize: '13px', padding: '6px 12px' }}>
                                {b.balance}
                            </span>
                        </td>
                    </tr>
                    ))}
                    {(!balances || balances.length === 0) && (
                    <tr>
                        <td colSpan={5} className="text-center" style={{ padding: '40px', color: 'var(--text-muted)' }}>لا توجد فوارغ مسجلة</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}></i> سجل الحركات الأخير</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
                <table className="data-table text-center">
                <thead>
                    <tr>
                    <th className="text-right">التاريخ</th>
                    <th className="text-right">العميل</th>
                    <th>النوع</th>
                    <th>الاتجاه</th>
                    <th>الكمية</th>
                    <th>الارتباط</th>
                    </tr>
                </thead>
                <tbody>
                    {(transactions || []).map((tx: any) => (
                    <tr key={tx.id}>
                        <td className="text-right" dir="ltr" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {new Date(tx.tx_date).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="text-right" style={{ fontWeight: 700 }}>
                            {customers?.find((c:any) => c.id === tx.customer)?.name || '...'}
                        </td>
                        <td>{tx.container_type}</td>
                        <td>
                            <span className={`badge ${tx.direction === 'out' ? 'badge-danger' : 'badge-success'}`}>
                                {tx.direction === 'out' ? 'صرف' : 'مُرتجع'}
                            </span>
                        </td>
                        <td style={{ fontWeight: 900 }}>{tx.quantity}</td>
                        <td>
                            {tx.sale ? <span className="badge badge-blue">فاتورة مبيعات</span> : <span className="badge badge-warning">حركة يدوية</span>}
                        </td>
                    </tr>
                    ))}
                    {(!transactions || transactions.length === 0) && (
                    <tr>
                        <td colSpan={6} className="text-center" style={{ padding: '40px', color: 'var(--text-muted)' }}>لا توجد حركات مسجلة حالياً</td>
                    </tr>
                    )}
                </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>

      {/* Manual Transaction Modal */}
      <div className={`modal ${isModalOpen ? 'show' : ''}`}>
         <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
         <div className="modal-box modal-sm">
             <div className="modal-header">
                 <div className="modal-title">تسجيل حركة فوارغ (مُرتجع أو صرف)</div>
                 <button className="modal-close" onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
             </div>
             <form onSubmit={handleSubmit}>
                 <div className="modal-body">
                     <div className="form-group" style={{ marginBottom: '14px' }}>
                         <label>الزبون / تاجر <span className="required">*</span></label>
                         <select className="form-control" required value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})}>
                             <option value="">-- اختر الزبون --</option>
                             {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                     </div>
                     <div className="form-group" style={{ marginBottom: '14px' }}>
                         <label>نوع الفارغ <span className="required">*</span></label>
                         <input className="form-control" required value={formData.container_type} onChange={e => setFormData({...formData, container_type: e.target.value})} />
                     </div>
                     <div className="form-grid">
                         <div className="form-group">
                             <label>اتجاه الحركة <span className="required">*</span></label>
                             <select className="form-control" required value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value})}>
                                 <option value="return">استلام (مُرتجع)</option>
                                 <option value="out">صرف (تسليم)</option>
                             </select>
                         </div>
                         <div className="form-group">
                             <label>العدد <span className="required">*</span></label>
                             <input type="number" min="1" className="form-control" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
                         </div>
                     </div>
                 </div>
                 <div className="modal-footer">
                     <button type="submit" className="btn btn-primary btn-full" style={{ fontSize: '18px', padding: '12px' }}>
                         <i className="fa-solid fa-check"></i> اعتماد النظام
                     </button>
                 </div>
             </form>
         </div>
      </div>
    </div>
  );
}
