import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { useToast } from '../../components/ui/Toast';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const invApi = api.injectEndpoints({
  endpoints: (b) => ({
    getInvoices: b.query({ query: (p: any) => ({ url: 'reports/invoices/', params: p }), providesTags: ['Sales'] }),
    getInvoiceDetail: b.query({ query: (id: string) => `sales/${id}/full-detail/`, providesTags: ['Sales'] }),
    cancelInvoice: b.mutation({ query: ({ id, reason }) => ({ url: `sales/${id}/cancel/`, method: 'POST', body: { reason } }), invalidatesTags: ['Sales'] }),
    editInvoice: b.mutation({ query: ({ id, data }) => ({ url: `sales/${id}/edit/`, method: 'PATCH', body: data }), invalidatesTags: ['Sales'] }),
    getCustomers: b.query({ query: () => 'customers/', providesTags: ['Customers'] }),
  }),
  overrideExisting: false,
});

const { useGetInvoicesQuery, useGetInvoiceDetailQuery, useCancelInvoiceMutation, useEditInvoiceMutation, useGetCustomersQuery } = invApi;

function StatusBadge({ cancelled }: { cancelled: boolean }) {
  return (
    <span style={{
      padding: '3px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '11px',
      background: cancelled ? '#fee2e2' : '#d1fae5',
      color: cancelled ? '#991b1b' : '#065f46',
    }}>
      {cancelled ? '✕ ملغاة' : '✓ مرحّلة'}
    </span>
  );
}

function PaymentBadge({ type }: { type: string }) {
  return (
    <span style={{
      padding: '3px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '11px',
      background: type === 'cash' ? '#fef3c7' : '#e0f2fe',
      color: type === 'cash' ? '#92400e' : '#0369a1',
    }}>
      {type === 'cash' ? '💵 نقدي' : '📋 آجل'}
    </span>
  );
}

export default function SalesInvoicesPage() {
  const { showToast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 8) + '01';

  const [dateFrom, setDateFrom]       = useState(monthStart);
  const [dateTo, setDateTo]           = useState(today);
  const [cancelledFlt, setCancelledFlt] = useState('false');
  const [customerFlt, setCustomerFlt]  = useState('');
  const [selectedId, setSelectedId]    = useState<string | null>(null);
  const [editingId, setEditingId]      = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ id: string; name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading, refetch } = useGetInvoicesQuery({ from: dateFrom, to: dateTo, cancelled: cancelledFlt, customer: customerFlt || undefined });
  const { data: custData } = useGetCustomersQuery({});
  const [cancelInvoice, { isLoading: cancelling }] = useCancelInvoiceMutation();

  const invoices = data?.results || [];
  const customers = custData?.results || (Array.isArray(custData) ? custData : []);

  const handleCancel = async () => {
    if (!cancelDialog || !cancelReason.trim()) { showToast('سبب الإلغاء مطلوب', 'error'); return; }
    try {
      await cancelInvoice({ id: cancelDialog.id, reason: cancelReason }).unwrap();
      showToast('تم إلغاء الفاتورة وترحيل القيود العكسية', 'success');
      setCancelDialog(null); setCancelReason('');
    } catch (e: any) { showToast(e?.data?.error || 'خطأ', 'error'); }
  };

  const totalAmount = invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.foreign_amount || 0), 0);

  if (isLoading) return <VegetableLoader text="جاري تحميل الفواتير..." />;

  return (
    <div style={{ direction: 'rtl' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 900, color: '#18181b' }}>
          <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#059669', marginLeft: '10px' }} />
          سجل الفواتير — العرض والتعديل والتقارير
        </h1>
        <p style={{ margin: 0, color: '#71717a', fontSize: '13px' }}>REQUIREMENT 1: يمكن عرض وتعديل وإلغاء أي فاتورة حتى بعد الترحيل</p>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e4e4e7', padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSt}>من تاريخ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>الزبون</label>
          <select value={customerFlt} onChange={e => setCustomerFlt(e.target.value)} style={inputSt}>
            <option value="">الكل</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>الحالة</label>
          <select value={cancelledFlt} onChange={e => setCancelledFlt(e.target.value)} style={inputSt}>
            <option value="false">مرحّلة فقط</option>
            <option value="true">ملغاة فقط</option>
            <option value="all">الكل</option>
          </select>
        </div>
        <button onClick={() => refetch()} style={{ padding: '10px 20px', background: '#059669', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 900, cursor: 'pointer' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ marginLeft: '6px' }} /> بحث
        </button>
      </div>

      {/* ── Summary Strip ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '12px 20px', display: 'flex', gap: '16px' }}>
          <span style={{ fontWeight: 700, color: '#71717a', fontSize: '13px' }}>عدد الفواتير:</span>
          <span style={{ fontWeight: 900, color: '#18181b' }}>{data?.count || invoices.length}</span>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '12px 20px', display: 'flex', gap: '16px' }}>
          <span style={{ fontWeight: 700, color: '#71717a', fontSize: '13px' }}>الإجمالي:</span>
          <span style={{ fontWeight: 900, color: '#059669', direction: 'ltr' }}>{totalAmount.toLocaleString('en', { minimumFractionDigits: 2 })} ₪</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8f8f8' }}>
            <tr>
              {['#', 'التاريخ', 'الزبون', 'طريقة الدفع', 'العملة', 'الإجمالي', 'الحالة', 'إجراءات'].map(h => (
                <th key={h} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#52525b', borderBottom: '2px solid #e4e4e7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any, i: number) => (
              <tr key={inv.id} style={{ borderBottom: '1px solid #f4f4f5', background: inv.is_cancelled ? '#fff8f8' : i % 2 === 0 ? 'white' : '#fafafa', opacity: inv.is_cancelled ? 0.7 : 1 }}>
                <td style={{ padding: '12px', color: '#a1a1aa', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: '12px', fontWeight: 700 }}>
                  {new Date(inv.sale_date).toLocaleDateString('en-US')}
                  <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                    {new Date(inv.sale_date).toLocaleTimeString('en-US')}
                  </div>
                </td>
                <td style={{ padding: '12px', fontWeight: 900 }}>{inv.customer_name || '— نقدي'}</td>
                <td style={{ padding: '12px' }}><PaymentBadge type={inv.payment_type} /></td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#6366f1' }}>{inv.currency_code}</td>
                <td style={{ padding: '12px', fontWeight: 900, color: '#059669', direction: 'ltr', textAlign: 'left' }}>
                  {parseFloat(inv.foreign_amount).toLocaleString('en', { minimumFractionDigits: 2 })} {inv.currency_symbol || ''}
                </td>
                <td style={{ padding: '12px' }}><StatusBadge cancelled={inv.is_cancelled} /></td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setSelectedId(inv.id)} style={{ background: '#e0f2fe', color: '#0369a1', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                      <i className="fa-solid fa-eye" /> عرض
                    </button>
                    {!inv.is_cancelled && (
                      <>
                        <button onClick={() => setEditingId(inv.id)} style={{ background: '#fef9c3', color: '#854d0e', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                          <i className="fa-solid fa-pen" /> تعديل
                        </button>
                        <button onClick={() => setCancelDialog({ id: inv.id, name: inv.customer_name || 'نقدي' })} style={{ background: '#fee2e2', color: '#991b1b', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                          <i className="fa-solid fa-ban" /> إلغاء
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#a1a1aa' }}>
            <i className="fa-solid fa-file-invoice" style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }} />
            <p style={{ fontWeight: 700 }}>لا توجد فواتير في هذه الفترة</p>
          </div>
        )}
      </div>

      {/* ── Invoice Detail Modal ── */}
      {selectedId && <InvoiceDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      {/* ── Edit Invoice Modal ── */}
      {editingId && <EditInvoiceModal id={editingId} onClose={() => setEditingId(null)} customers={customers} />}

      {/* ── Cancel Dialog ── */}
      {cancelDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 8px', color: '#dc2626', fontWeight: 900 }}>
              <i className="fa-solid fa-ban" style={{ marginLeft: '8px' }} />
              إلغاء فاتورة — {cancelDialog.name}
            </h3>
            <p style={{ margin: '0 0 16px', color: '#71717a', fontSize: '13px' }}>
              سيتم ترحيل قيود عكسية تلقائياً لإلغاء أثر الفاتورة محاسبياً. هذا الإجراء لا يُحذف الفاتورة.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelSt}>سبب الإلغاء (إلزامي)*</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                style={{ width: '100%', padding: '10px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700, resize: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                placeholder="مثال: خطأ في السعر..." />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '14px' }}>
                {cancelling ? '...' : 'تأكيد الإلغاء'}
              </button>
              <button onClick={() => { setCancelDialog(null); setCancelReason(''); }} style={{ padding: '12px 20px', background: '#f4f4f5', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditInvoiceModal({ id, onClose, customers }: { id: string; onClose: () => void; customers: any[] }) {
  const { showToast } = useToast();
  const { data: inv, isLoading } = useGetInvoiceDetailQuery(id, { refetchOnMountOrArgChange: true });
  const [editInvoice, { isLoading: isSaving }] = useEditInvoiceMutation();

  const [form, setForm] = useState<any>(null);

  React.useEffect(() => {
    if (inv) {
      setForm({
        customer: inv.customer || '',
        payment_type: inv.payment_type || 'cash',
        currency_code: inv.currency_code || 'ILS',
        exchange_rate: inv.exchange_rate || '1.0',
        reason: 'تعديل أسعار/كميات',
        discount: 0,
        items: inv.lines.map((l: any) => ({
          ...l,
          shipment_item: l.shipment_item,
          quantity: l.quantity,
          unit_price: l.unit_price,
          commission_rate: l.commission_rate,
          discount: l.discount,
          gross_weight: l.gross_weight,
          net_weight: l.net_weight,
          containers_out: l.containers_out,
        })),
      });
    }
  }, [inv]);

  if (isLoading || !form) return <VegetableLoader text="جاري تحميل بيانات الفاتورة للتعديل..." fullScreen />;

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    
    // Recalc subtotal
    const q = parseFloat(newItems[index].quantity || 0);
    const p = parseFloat(newItems[index].unit_price || 0);
    newItems[index].subtotal = (q * p).toFixed(3);

    setForm({ ...form, items: newItems });
  };

  const handleSave = async () => {
    if (!form.reason.trim()) { showToast('سبب التعديل الزامي للمراجعة', 'error'); return; }
    try {
      await editInvoice({ id, data: form }).unwrap();
      showToast('تم تعديل الفاتورة بنجاح واعتماد القيود الجديدة', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.data?.error || 'حدث خطأ أثناء تعديل الفاتورة', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '900px', width: '100%', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontWeight: 900, color: '#854d0e', fontSize: '18px' }}>
              <i className="fa-solid fa-pen-to-square" style={{ marginLeft: '10px' }} />
              تعديل فاتورة مرحّلة
            </h2>
            <p style={{ margin: 0, color: '#71717a', fontSize: '13px' }}>سيتم إنشاء قيود عكسية للنسخة السابقة وإصدار فاتورة محدثة تلقائياً.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f4f4f5', border: 'none', borderRadius: '8px', padding: '8px 12px', fontWeight: 900, cursor: 'pointer' }}>✕ رجوع</button>
        </div>

        <div style={{ display: 'flex', gap: '16px', background: '#fafafa', padding: '16px', borderRadius: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>الزبون</label>
            <select value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} style={inputSt}>
              <option value="">-- نقدي --</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>طريقة الدفع</label>
            <select value={form.payment_type} onChange={e => setForm({ ...form, payment_type: e.target.value })} style={inputSt}>
              <option value="cash">نقدي</option>
              <option value="credit">آجل (ذمم)</option>
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelSt}>سبب التعديل (إلزامي)*</label>
            <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={inputSt} placeholder="مثال: تصحيح سعر" />
          </div>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e4e4e7', borderRadius: '12px', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8f8f8', position: 'sticky', top: 0 }}>
              <tr>
                {['الصنف', 'المزارع', 'العدد', 'السعر', 'كميسيون%', 'الصافي', 'الإجمالي'].map(h => (
                  <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b', borderBottom: '2px solid #e4e4e7' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.map((line: any, index: number) => (
                <tr key={index} style={{ borderBottom: '1px solid #f4f4f5' }}>
                  <td style={{ padding: '10px', fontWeight: 900 }}>{line.item_name}</td>
                  <td style={{ padding: '10px', color: '#71717a', fontSize: '12px' }}>{line.supplier_name || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <input type="number" value={line.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} style={{ width: '70px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <input type="number" value={line.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <input type="number" value={line.commission_rate} onChange={e => handleItemChange(index, 'commission_rate', e.target.value)} style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <input type="number" value={line.net_weight} onChange={e => handleItemChange(index, 'net_weight', e.target.value)} style={{ width: '70px', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </td>
                  <td style={{ padding: '10px', fontWeight: 900, direction: 'ltr', textAlign: 'left' }}>
                    {parseFloat(line.subtotal || 0).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '12px 24px', background: '#f4f4f5', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>
            الغاء التعديل
          </button>
          <button onClick={handleSave} disabled={isSaving} style={{ padding: '12px 30px', background: '#854d0e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '14px' }}>
            {isSaving ? 'جارٍ الحفظ والترحيل...' : 'تأكيد وحفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useGetInvoiceDetailQuery(id);
  const inv = data;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '800px', width: '100%', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }}>
        {isLoading ? <VegetableLoader text="جاري التحميل..." /> : !inv ? <p>بيانات غير متوفرة</p> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontWeight: 900, color: '#18181b', fontSize: '18px' }}>
                  <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#059669', marginLeft: '10px' }} />
                  تفاصيل الفاتورة
                  {inv.cancelled && <span style={{ marginRight: '12px', background: '#fee2e2', color: '#991b1b', padding: '3px 12px', borderRadius: '20px', fontSize: '12px' }}>ملغاة</span>}
                </h2>
                <p style={{ margin: 0, color: '#71717a', fontSize: '13px' }}>
                  {inv.customer_name || 'بيع نقدي'} &bull; {inv.sale_date && new Date(inv.sale_date).toLocaleString('ar-EG')} &bull; {inv.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                </p>
                {inv.cancel_reason && (
                  <p style={{ margin: '8px 0 0', color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>
                    سبب الإلغاء: {inv.cancel_reason}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669', direction: 'ltr' }}>
                  {parseFloat(inv.foreign_amount || 0).toLocaleString('en', { minimumFractionDigits: 2 })} {inv.currency_symbol || inv.currency_code}
                </div>
                {inv.currency_code !== 'ILS' && (
                  <div style={{ fontSize: '12px', color: '#a1a1aa', direction: 'ltr' }}>
                    ≈ {parseFloat(inv.base_amount || 0).toLocaleString('en', { minimumFractionDigits: 2 })} ₪ (بسعر {inv.exchange_rate})
                  </div>
                )}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8f8f8' }}>
                <tr>
                  {['الصنف', 'المزارع', 'العدد', 'القائم', 'الصافي', 'السعر', 'الكميسيون%', 'الخصم', 'الإجمالي'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#52525b', borderBottom: '2px solid #e4e4e7' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(inv.lines || inv.items || []).map((line: any, i: number) => (
                  <tr key={line.id || i} style={{ borderBottom: '1px solid #f4f4f5' }}>
                    <td style={{ padding: '10px', fontWeight: 900 }}>{line.item_name}</td>
                    <td style={{ padding: '10px', color: '#71717a', fontSize: '12px' }}>{line.supplier_name || '—'}</td>
                    <td style={{ padding: '10px', direction: 'ltr', textAlign: 'center' }}>{line.quantity}</td>
                    <td style={{ padding: '10px', direction: 'ltr', textAlign: 'center' }}>{line.gross_weight}</td>
                    <td style={{ padding: '10px', direction: 'ltr', textAlign: 'center' }}>{line.net_weight}</td>
                    <td style={{ padding: '10px', fontWeight: 700, color: '#059669', direction: 'ltr' }}>{line.unit_price}</td>
                    <td style={{ padding: '10px', color: '#0ea5e9', direction: 'ltr' }}>{line.commission_rate}%</td>
                    <td style={{ padding: '10px', color: '#ef4444', direction: 'ltr' }}>{line.discount}</td>
                    <td style={{ padding: '10px', fontWeight: 900, color: '#18181b', direction: 'ltr' }}>
                      {parseFloat(line.subtotal || 0).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'left', marginTop: '20px' }}>
              <button onClick={onClose} style={{ background: '#f4f4f5', border: 'none', borderRadius: '10px', padding: '12px 24px', fontWeight: 900, cursor: 'pointer' }}>إغلاق</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const labelSt: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#71717a', display: 'block', marginBottom: '4px' };
const inputSt: React.CSSProperties = { padding: '10px 12px', border: '1px solid #e4e4e7', borderRadius: '8px', fontWeight: 700, fontSize: '13px', outline: 'none' };
