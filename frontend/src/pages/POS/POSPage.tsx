import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { useGetItemsQuery } from '../inventory/Inventory';

const posApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOpenShipments: build.query({
      query: () => 'shipments/?status=open',
      providesTags: ['Shipments'],
    }),
    getCustomers: build.query({
      query: () => 'customers/',
      providesTags: ['Customers'],
    }),
    createSale: build.mutation({
      query: (body) => ({
        url: 'sales/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Shipments', 'Customers', 'Sales'],
    }),
  }),
});

export const {
  useGetOpenShipmentsQuery,
  useGetCustomersQuery,
  useCreateSaleMutation,
} = posApi;

interface CartItem {
  shipment_item_id: string;
  name: string;
  supplier: string;
  quantity: number;
  unit_price: number;
  commission_rate: number; // % كمسيون على الزبون
  subtotal: number;
  commission_amount: number;
  containers_out: number;
}

export default function POSPage() {
  const { showToast } = useToast();
  const { data: shipments, isLoading: loadingShipments } = useGetOpenShipmentsQuery({});
  const { data: customersRaw } = useGetCustomersQuery({});
  const { data: itemsRaw } = useGetItemsQuery({});
  const [createSale, { isLoading: isCreatingSale }] = useCreateSaleMutation();

  // ──────────── Cart State ────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [discount, setDiscount] = useState<number | ''>('');
  const [amountReceived, setAmountReceived] = useState<number | ''>('');

  // ──────────── Modal State ────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeShipmentItem, setActiveShipmentItem] = useState<any>(null);
  const [modalQty, setModalQty] = useState<number | ''>('');
  const [modalPrice, setModalPrice] = useState<number | ''>('');
  const [modalCommission, setModalCommission] = useState<number>(0);

  // ──────────── Search State ────────────
  const [search, setSearch] = useState('');

  const customers = (customersRaw?.results || (Array.isArray(customersRaw) ? customersRaw : [])) as any[];

  // Build all available shipment items grouped by item_name
  const shipmentItems = (shipments || [] as any[]).flatMap((s: any) =>
    (s.items || []).map((i: any) => ({
      ...i,
      shipmentId: s.id,
      supplierName: s.supplier_name,
      displayName: i.item_name,
      hasStock: Number(i.remaining_qty) > 0,
    }))
  );

  // Build a catalog: one card per distinct item name, linking to the shipment item
  const allItems = (itemsRaw?.results || (Array.isArray(itemsRaw) ? itemsRaw : [])) as any[];

  // Group shipment items by item name (for display)
  const catalogMap: Record<string, any> = {};
  shipmentItems.forEach((si: any) => {
    const key = si.item_name;
    if (!catalogMap[key]) {
      catalogMap[key] = { ...si, totalRemaining: 0, items: [] };
    }
    catalogMap[key].totalRemaining += Number(si.remaining_qty);
    catalogMap[key].items.push(si);
  });

  // Also include ALL items from inventory even if out of stock
  allItems.forEach((item: any) => {
    if (!catalogMap[item.name]) {
      catalogMap[item.name] = {
        item_name: item.name,
        displayName: item.name,
        supplierName: '',
        totalRemaining: 0,
        expected_price: 0,
        items: [],
        hasStock: false,
        outOfStockOnly: true,
      };
    }
  });

  const catalog = Object.values(catalogMap).filter((item: any) =>
    item.item_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ──────────── Calculations ────────────
  const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
  const totalCommission = cart.reduce((sum, i) => sum + i.commission_amount, 0);
  const discountAmount = Number(discount) || 0;
  const netTotal = subtotal - discountAmount; // after discount
  const received = Number(amountReceived) || 0;
  const change = received > 0 ? received - netTotal : 0;

  // ──────────── Keyboard Shortcuts ────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isModalOpen) { e.preventDefault(); handleCheckout(); }
      if (e.key === 'F3' && !isModalOpen) { e.preventDefault(); setCart([]); setDiscount(''); setAmountReceived(''); }
      if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, payType, selectedCustomerId, isModalOpen, discount, amountReceived]);

  // ──────────── Open product modal ────────────
  const openAddItemModal = (catalogEntry: any) => {
    if (catalogEntry.outOfStockOnly || catalogEntry.items.length === 0) {
      return showToast('لا توجد إرساليات مفتوحة لهذا الصنف', 'info');
    }
    // Pick the first available shipment item (with remaining qty)
    const available = catalogEntry.items.find((si: any) => Number(si.remaining_qty) > 0);
    if (!available) return showToast('الكمية المتاحة صفر', 'info');

    setActiveShipmentItem({ ...available, catalogEntry });
    setModalPrice(available.expected_price ? Number(available.expected_price) : '');
    setModalQty('');
    setModalCommission(0);
    setIsModalOpen(true);
  };

  // ──────────── Add item to cart ────────────
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShipmentItem || !modalQty || !modalPrice) return;

    const qty = Number(modalQty);
    const prc = Number(modalPrice);
    const comm = Number(modalCommission) || 0;
    const sub = qty * prc;
    const commAmt = (sub * comm) / 100;

    setCart(prev => [...prev, {
      shipment_item_id: activeShipmentItem.id,
      name: activeShipmentItem.item_name,
      supplier: activeShipmentItem.supplierName,
      quantity: qty,
      unit_price: prc,
      commission_rate: comm,
      subtotal: sub,
      commission_amount: commAmt,
      containers_out: 0,
    }]);

    setIsModalOpen(false);
    setActiveShipmentItem(null);
  };

  // ──────────── Remove from cart ────────────
  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // ──────────── Checkout ────────────
  const handleCheckout = async () => {
    if (cart.length === 0) return showToast('الفاتورة فارغة', 'info');
    if (payType === 'credit' && !selectedCustomerId) return showToast('اختر التاجر للبيع الآجل', 'info');

    try {
      const payload = {
        payment_type: payType,
        customer: selectedCustomerId || null,
        currency_code: currencyCode,
        discount: discountAmount,
        items: cart.map(i => ({
          shipment_item: i.shipment_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          commission_rate: i.commission_rate,
          containers_out: i.containers_out,
        }))
      };

      await createSale(payload).unwrap();
      showToast('✅ تم اعتماد الفاتورة بنجاح', 'success');
      setCart([]);
      setSelectedCustomerId('');
      setDiscount('');
      setAmountReceived('');
    } catch (err: any) {
      const msg = err?.data?.detail || err?.data?.non_field_errors?.[0] || 'حدث خطأ في الحفظ';
      showToast(msg, 'error');
    }
  };

  if (loadingShipments) return <VegetableLoader text="جاري تجهيز بوابة المبيعات السريعة..." fullScreen />;

  const currSymbol = currencyCode === 'ILS' ? '₪' : currencyCode === 'USD' ? '$' : currencyCode === 'JOD' ? 'د.أ' : 'ج';

  return (
    <div style={{ display: 'flex', gap: '24px', minHeight: 'calc(100vh - 140px)', direction: 'rtl' }}>

      {/* ── RIGHT: Product Grid ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>الأصناف السريعة</h2>
          <div style={{
            background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px',
            display: 'flex', alignItems: 'center', padding: '0 12px', flex: 1, maxWidth: '300px'
          }}>
            <i className="fa-solid fa-search" style={{ color: '#9ca3af', marginLeft: '8px' }}></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن صنف..."
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, height: '42px', fontFamily: 'inherit', fontWeight: 700 }}
            />
          </div>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, color: '#059669' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', marginLeft: '6px' }}></span>
            {catalog.filter((c: any) => c.totalRemaining > 0).length} صنف متاح
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '12px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 220px)',
          paddingBottom: '20px',
        }}>
          {catalog.map((entry: any, idx: number) => {
            const hasStock = entry.totalRemaining > 0;
            return (
              <button
                key={idx}
                onClick={() => openAddItemModal(entry)}
                style={{
                  background: hasStock ? 'white' : '#f9fafb',
                  border: `2px solid ${hasStock ? '#d1fae5' : '#e5e7eb'}`,
                  borderRadius: '20px',
                  padding: '16px 12px',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s',
                  opacity: hasStock ? 1 : 0.55,
                  boxShadow: hasStock ? '0 2px 8px rgba(16,185,129,0.08)' : 'none',
                }}
                onMouseOver={e => { if (hasStock) (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              >
                <div style={{
                  height: '56px', background: hasStock ? '#ecfdf5' : '#f3f4f6',
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', fontWeight: 900, color: hasStock ? '#059669' : '#9ca3af',
                }}>
                  {entry.item_name?.charAt(0) || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#1f2937', marginBottom: '4px', lineHeight: 1.3 }}>
                    {entry.item_name}
                  </div>
                  {entry.supplierName && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, marginBottom: '4px' }}>
                      {entry.supplierName}
                    </div>
                  )}
                  <div style={{
                    fontSize: '11px', fontWeight: 800, marginTop: '4px',
                    color: hasStock ? '#059669' : '#d1d5db',
                    background: hasStock ? '#ecfdf5' : '#f3f4f6',
                    padding: '2px 8px', borderRadius: '6px', display: 'inline-block'
                  }}>
                    {hasStock ? `${entry.totalRemaining} متاح` : 'منتهي'}
                  </div>
                </div>
              </button>
            );
          })}
          {catalog.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#9ca3af', fontWeight: 700 }}>
              لا توجد أصناف مطابقة
            </div>
          )}
        </div>
      </div>

      {/* ── LEFT: Invoice / Cart ── */}
      <div style={{ width: '380px', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '80px', alignSelf: 'flex-start' }}>

        {/* Payment type toggle */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '6px', display: 'flex', gap: '6px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {(['cash', 'credit'] as const).map(t => (
            <button key={t} onClick={() => setPayType(t)} style={{
              flex: 1, height: '44px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '14px', fontFamily: 'inherit',
              background: payType === t ? (t === 'cash' ? '#065f46' : '#ea580c') : 'transparent',
              color: payType === t ? 'white' : '#9ca3af',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}>
              <i className={`fa-solid ${t === 'cash' ? 'fa-money-bill-wave' : 'fa-user-clock'}`}></i>
              {t === 'cash' ? '💵  كاش' : '🧾  ذمة / آجل'}
            </button>
          ))}
        </div>

        {/* Customer selector (credit only) */}
        {payType === 'credit' && (
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            style={{
              width: '100%', height: '48px', border: '2px solid #fed7aa',
              borderRadius: '14px', padding: '0 14px', fontWeight: 700, fontFamily: 'inherit',
              fontSize: '14px', background: '#fff7ed', color: '#c2410c', outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">-- اختر التاجر --</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {/* Currency */}
        <div style={{ display: 'flex', gap: '6px', background: 'white', padding: '8px', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {['ILS', 'USD', 'JOD', 'EGP'].map(code => (
            <button key={code} onClick={() => setCurrencyCode(code)} style={{
              flex: 1, height: '36px', borderRadius: '10px', border: '2px solid',
              borderColor: currencyCode === code ? '#059669' : '#e5e7eb',
              background: currencyCode === code ? '#059669' : 'white',
              color: currencyCode === code ? 'white' : '#9ca3af',
              fontWeight: 800, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
              {code === 'ILS' ? '₪' : code === 'USD' ? '$' : code === 'JOD' ? 'د.أ' : 'ج'}
            </button>
          ))}
        </div>

        {/* Invoice Items */}
        <div style={{
          background: 'white', borderRadius: '20px', overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flex: 1,
        }}>
          {/* Invoice Header */}
          <div style={{ background: '#f0fdf4', padding: '14px 16px', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: '14px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-receipt"></i> الفاتورة ({cart.length})
            </span>
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); setDiscount(''); setAmountReceived(''); }} style={{
                background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px',
                padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
              }}>
                <i className="fa-solid fa-trash-can"></i> مسح الكل (F3)
              </button>
            )}
          </div>

          {/* Items list */}
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '8px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#d1d5db', fontWeight: 700 }}>
                اضغط على الأصناف لإضافتها...
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 8px', borderBottom: '1px solid #f9fafb',
                position: 'relative',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1f2937' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginTop: '2px' }}>
                    {item.quantity} × {item.unit_price} {currSymbol}
                    {item.commission_rate > 0 && (
                      <span style={{ color: '#f59e0b', marginRight: '6px' }}>
                        + {item.commission_rate}% كمسيون
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'left', minWidth: '70px' }}>
                  <div style={{ fontWeight: 900, color: '#059669', fontSize: '14px' }}>
                    {item.subtotal.toFixed(2)} {currSymbol}
                  </div>
                  {item.commission_amount > 0 && (
                    <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>
                      +{item.commission_amount.toFixed(2)} كمسيون
                    </div>
                  )}
                </div>
                <button onClick={() => removeFromCart(idx)} style={{
                  background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <i className="fa-solid fa-xmark" style={{ fontSize: '12px' }}></i>
                </button>
              </div>
            ))}
          </div>

          {/* Footer calculations */}
          <div style={{ padding: '12px 16px', borderTop: '2px solid #f0fdf4', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6b7280', fontWeight: 700, fontSize: '13px' }}>مجموع الأصناف</span>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>{subtotal.toFixed(2)} {currSymbol}</span>
            </div>

            {/* Commission total */}
            {totalCommission > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '13px' }}>
                  <i className="fa-solid fa-percent"></i> إجمالي الكمسيون
                </span>
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#f59e0b' }}>{totalCommission.toFixed(2)} {currSymbol}</span>
              </div>
            )}

            {/* Discount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef9c3', borderRadius: '12px', padding: '8px 12px' }}>
              <i className="fa-solid fa-tag" style={{ color: '#ca8a04' }}></i>
              <span style={{ color: '#ca8a04', fontWeight: 800, fontSize: '13px', flex: 1 }}>خصم</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={discount}
                  onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  style={{
                    width: '80px', height: '32px', border: '2px solid #fde68a', borderRadius: '8px',
                    textAlign: 'center', fontWeight: 800, fontSize: '14px', outline: 'none',
                    background: 'white', fontFamily: 'inherit', color: '#ca8a04'
                  }}
                />
                <span style={{ fontWeight: 700, color: '#ca8a04', fontSize: '12px' }}>{currSymbol}</span>
              </div>
            </div>

            {/* Net Total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#ecfdf5', borderRadius: '12px', padding: '10px 14px'
            }}>
              <span style={{ color: '#065f46', fontWeight: 800, fontSize: '14px' }}>الإجمالي المستحق</span>
              <span style={{ fontWeight: 900, fontSize: '22px', color: '#065f46' }}>
                {netTotal.toFixed(2)} {currSymbol}
              </span>
            </div>

            {/* Amount Received & Change (cash only) */}
            {payType === 'cash' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f9ff', borderRadius: '12px', padding: '8px 12px' }}>
                  <i className="fa-solid fa-money-bill-wave" style={{ color: '#0284c7' }}></i>
                  <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '13px', flex: 1 }}>المبلغ المستلم</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={amountReceived}
                      onChange={e => setAmountReceived(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      style={{
                        width: '90px', height: '36px', border: '2px solid #bae6fd', borderRadius: '8px',
                        textAlign: 'center', fontWeight: 900, fontSize: '16px', outline: 'none',
                        background: 'white', fontFamily: 'inherit', color: '#0284c7'
                      }}
                    />
                    <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '12px' }}>{currSymbol}</span>
                  </div>
                </div>

                {received > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: change >= 0 ? '#f0fdf4' : '#fef2f2',
                    borderRadius: '12px', padding: '10px 14px',
                    border: `2px solid ${change >= 0 ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    <span style={{ color: change >= 0 ? '#059669' : '#dc2626', fontWeight: 800, fontSize: '14px' }}>
                      {change >= 0 ? '↩️  الباقي / المرتجع' : '⚠️  ناقص'}
                    </span>
                    <span style={{
                      fontWeight: 900, fontSize: '24px',
                      color: change >= 0 ? '#059669' : '#dc2626'
                    }}>
                      {Math.abs(change).toFixed(2)} {currSymbol}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCreatingSale}
              style={{
                width: '100%', height: '54px', borderRadius: '16px', border: 'none',
                background: cart.length > 0 ? 'linear-gradient(135deg, #065f46, #059669)' : '#e5e7eb',
                color: cart.length > 0 ? 'white' : '#9ca3af',
                fontWeight: 900, fontSize: '16px', cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: cart.length > 0 ? '0 4px 20px rgba(5,150,105,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isCreatingSale ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...</>
              ) : (
                <><i className="fa-solid fa-check-circle"></i> تأكيد وحفظ الفاتورة <span style={{ fontSize: '12px', opacity: 0.7 }}>(F2)</span></>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: Add Item ── */}
      {isModalOpen && activeShipmentItem && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '28px', width: '100%', maxWidth: '420px',
            padding: '32px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', direction: 'rtl'
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <div style={{
                width: '60px', height: '60px', background: '#ecfdf5', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', fontWeight: 900, color: '#059669', flexShrink: 0
              }}>
                {activeShipmentItem.item_name?.charAt(0)}
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '20px', color: '#1f2937' }}>
                  {activeShipmentItem.item_name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>
                  {activeShipmentItem.supplierName} &nbsp;·&nbsp; متاح: <strong style={{ color: '#059669' }}>{activeShipmentItem.remaining_qty}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  الكمية
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={activeShipmentItem.remaining_qty}
                  required
                  autoFocus
                  value={modalQty}
                  onChange={e => setModalQty(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{
                    width: '100%', height: '56px', border: '2px solid #e5e7eb', borderRadius: '14px',
                    textAlign: 'center', fontWeight: 900, fontSize: '24px', outline: 'none',
                    background: '#f9fafb', fontFamily: 'inherit', color: '#1f2937', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#059669'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Price */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  السعر / الوحدة ({currencyCode})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={modalPrice}
                  onChange={e => setModalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{
                    width: '100%', height: '52px', border: '2px solid #e5e7eb', borderRadius: '14px',
                    textAlign: 'center', fontWeight: 900, fontSize: '20px', outline: 'none',
                    background: '#f0fdf4', fontFamily: 'inherit', color: '#059669', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Commission on customer */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  كمسيون على الزبون (%) — اختياري
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={modalCommission}
                    onChange={e => setModalCommission(Number(e.target.value))}
                    style={{
                      flex: 1, height: '48px', border: '2px solid #fde68a', borderRadius: '14px',
                      textAlign: 'center', fontWeight: 800, fontSize: '18px', outline: 'none',
                      background: '#fffbeb', fontFamily: 'inherit', color: '#ca8a04', boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ color: '#ca8a04', fontWeight: 800, fontSize: '20px' }}>%</span>
                </div>
                {/* Live preview */}
                {modalQty && modalPrice && Number(modalQty) > 0 && Number(modalPrice) > 0 && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f9fafb', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>
                    الإجمالي: <strong style={{ color: '#059669' }}>{(Number(modalQty) * Number(modalPrice)).toFixed(2)} {currSymbol}</strong>
                    {modalCommission > 0 && (
                      <> &nbsp;+ كمسيون: <strong style={{ color: '#f59e0b' }}>{((Number(modalQty) * Number(modalPrice) * modalCommission) / 100).toFixed(2)} {currSymbol}</strong></>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" style={{
                  flex: 1, height: '52px', background: 'linear-gradient(135deg, #065f46, #059669)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontWeight: 900, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                  <i className="fa-solid fa-plus"></i> إضافة للفاتورة
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{
                  padding: '0 20px', height: '52px', background: '#f9fafb', color: '#6b7280',
                  border: '2px solid #e5e7eb', borderRadius: '14px',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit'
                }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
