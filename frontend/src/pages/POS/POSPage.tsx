import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { SmartSearch } from '../../components/ui/SmartSearch';

function stripDiacritics(str: string): string {
  if (!str) return '';
  return str.replace(/[\u064B-\u065F\u0670]/g, '');
}

const posApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOpenShipments: build.query({ query: () => 'shipments/?status=open', providesTags: ['Shipments'] }),
    getAllItems: build.query({ query: () => 'items/', providesTags: ['Items'] }),
    getCustomers: build.query({ 
      query: (params: any) => ({ url: 'customers/', params: params && typeof params === 'object' ? params : (params ? { search: params } : {}) }),
      providesTags: ['Customers'] 
    }),
    createSale: build.mutation({
      query: (body) => ({ url: 'sales/', method: 'POST', body }),
      invalidatesTags: ['Shipments', 'Customers', 'Sales'],
    }),
  }),
});

export const {
  useGetOpenShipmentsQuery, useGetAllItemsQuery,
  useGetCustomersQuery, useCreateSaleMutation,
} = posApi;

interface CartLine {
  shipment_item_id: string;
  item_name: string;
  supplier_name: string;
  unit: string;
  qty: string;
  gross_weight: string;
  tare_weight: number;
  net_weight: string;
  price: string;
  price_on: 'gross' | 'net';
  commission_rate: string;
  commission_basis?: string;
  commission_calc_type?: string;
  discount: string;
  has_empties: boolean;
  empties_count: string;
  // Metadata for tare_weight derivation
  tare_per_unit: number; 
}

export default function POSPage() {
  const { showToast } = useToast();
  const { data: shipments, isLoading: loadingShipments } = useGetOpenShipmentsQuery({});
  const { data: allItemsRaw } = useGetAllItemsQuery({});
  const { data: customersRaw } = useGetCustomersQuery('');
  const [createSale, { isLoading: saving }] = useCreateSaleMutation();

  const customers = customersRaw?.results || (Array.isArray(customersRaw) ? customersRaw : []);
  
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [currencyCode, setCurrencyCode] = useState('ILS');

  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState('ILS');
  const [exchangeRate, setExchangeRate] = useState('3.80');

  const handleCurrencySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val !== 'ILS') {
      setPendingCurrency(val);
      setShowExchangeModal(true);
    } else {
      setCurrencyCode('ILS');
    }
  };

  const emptyLine: CartLine = {
    shipment_item_id: '',
    item_name: '',
    supplier_name: '',
    unit: 'صندوق',
    qty: '',
    gross_weight: '',
    tare_weight: 0,
    net_weight: '',
    price: '',
    price_on: 'net',
    commission_rate: selectedCustomer?.commission_rate != null ? String(selectedCustomer.commission_rate) : '0',
    commission_basis: selectedCustomer?.commission_type_detail?.calc_basis || 'AMOUNT',
    commission_calc_type: selectedCustomer?.commission_type_detail?.calc_type || 'percent',
    discount: '0',
    has_empties: false,
    empties_count: '',
    tare_per_unit: 0
  };

  const [cart, setCart] = useState<CartLine[]>([ { ...emptyLine } ]);

  const updateLine = (index: number, field: keyof CartLine, value: any) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    
    // Auto-calculate on qty/gross weight updates
    if (field === 'qty' || field === 'gross_weight') {
      const q = parseFloat(newCart[index].qty) || 0;
      const g = parseFloat(newCart[index].gross_weight) || 0;
      const tpu = newCart[index].tare_per_unit;
      
      const tare_total = q * tpu;
      newCart[index].tare_weight = tare_total;
      
      if (g > 0) {
        newCart[index].net_weight = Math.max(0, g - tare_total).toString();
      } else {
        newCart[index].net_weight = '';
      }
    }
    
    setCart(newCart);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Flow logic:
      // ItemName -> Qty -> Unit -> Gross -> Price -> Commission -> Discount -> Empties Check -> Empties Count -> Next Line
      const flow = ['qty', 'unit', 'gross_weight', 'price', 'commission_rate', 'discount', 'has_empties'];
      if(cart[index].has_empties) flow.push('empties_count');

      const currentIndex = flow.indexOf(field);
      if (currentIndex > -1 && currentIndex < flow.length - 1) {
         const nextField = flow[currentIndex + 1];
         document.getElementById(`cart-${index}-${nextField}`)?.focus();
      } else if (currentIndex === flow.length - 1) {
         if (index === cart.length - 1) {
           setCart([...cart, { ...emptyLine }]);
           setTimeout(() => {
             document.getElementById(`cart-${index + 1}-item_search`)?.focus();
           }, 50);
         } else {
           document.getElementById(`cart-${index + 1}-item_search`)?.focus();
         }
      }
    }
  };

  const shipmentItems = (shipments || [] as any[]).flatMap((s: any) =>
    (s.items || []).map((si: any) => ({
      ...si,
      shp_id: s.id,
      supplier_name: s.supplier_name,
      hasStock: Number(si.remaining_qty) > 0,
    }))
  ).filter((si: any) => si.hasStock);

  const allItems = allItemsRaw?.results || (Array.isArray(allItemsRaw) ? allItemsRaw : []);
  
  // Mapping catalog for SmartSearch or manual
  const catalogMap: Record<string, any> = {};
  (allItems as any[]).forEach((item: any) => {
    catalogMap[item.name] = {
      item_name: item.name,
      tare_weight: Number(item.tare_weight) || 0,
      price_on: item.price_on || 'net',
      shipment_items: [],
      best_price: 0,
    };
  });
  shipmentItems.forEach((si: any) => {
    if(!catalogMap[si.item_name]) return;
    catalogMap[si.item_name].shipment_items.push(si);
    if (si.expected_price) catalogMap[si.item_name].best_price = Number(si.expected_price);
  });
  
  const catalogList = Object.values(catalogMap).filter((c:any) => c.shipment_items.length > 0);

  // Totals
  const getSubtotal = (line: CartLine) => {
    const q = parseFloat(line.qty) || 0;
    const p = parseFloat(line.price) || 0;
    const baseQty = line.price_on === 'net' ? (parseFloat(line.net_weight) || q) : (parseFloat(line.gross_weight) || q);
    return baseQty * p;
  };

  const getCommissionAmount = (line: CartLine) => {
    const rate = parseFloat(line.commission_rate) || 0;
    const basis = line.commission_basis || 'AMOUNT';
    const type = line.commission_calc_type || 'percent';
    const q = parseFloat(line.qty) || 0;
    const g = parseFloat(line.gross_weight) || 0;
    const n = parseFloat(line.net_weight) || 0;
    
    let baseVal = getSubtotal(line);
    if (basis === 'NET_WEIGHT') baseVal = n || q;
    else if (basis === 'GROSS_WEIGHT') baseVal = g || q;
    else if (basis === 'QUANTITY') baseVal = q;
    
    if (basis === 'AMOUNT') {
       if (type === 'fixed') return rate; // Fixed amount per line
       return (baseVal * rate) / 100;
    } else {
       // If basis is quantity/weight, rate is applied per unit. E.g. fixed 2 per kg, or percent doesn't make sense for weight so assume fixed multiplier.
       return baseVal * rate; 
    }
  };

  const subtotal = cart.reduce((s, l) => s + getSubtotal(l), 0);
  const totalCommission = cart.reduce((s, l) => s + getCommissionAmount(l), 0);
  const lineDiscounts = cart.reduce((s, l) => s + (parseFloat(l.discount)||0), 0);
  const netTotal = subtotal + totalCommission - lineDiscounts - invoiceDiscount;
  const change = amountReceived > 0 ? amountReceived - netTotal : 0;

  const handleSaveDraft = () => {
     if (cart.length === 1 && !cart[0].shipment_item_id) return;
     showToast('تم حفظ الفاتورة كمسودة مؤقتاً', 'success');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); handleSaveDraft(); }
      if (e.key === 'F10') { e.preventDefault(); handleCheckout(); }
      if (e.key === 'Escape') { e.preventDefault(); clearCart(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, payType, selectedCustomer, invoiceDiscount, amountReceived]);

  // Request C: Auto load commission when picking customer
  const handleCustomerSelect = (cust: any) => {
     setSelectedCustomer(cust);
     if (!cust) return;

     const basis = cust.commission_type_detail?.calc_basis || 'AMOUNT';
     const type = cust.commission_type_detail?.calc_type || 'percent';
     const rateVal = cust.commission_rate != null ? cust.commission_rate : cust.commission_type_detail?.default_rate;
     const normalizedRate = (rateVal == null ? 0 : rateVal);

     const newCart = cart.map((c) => ({
        ...c,
        commission_rate: String(normalizedRate),
        commission_basis: basis,
        commission_calc_type: type,
     }));
     setCart(newCart);
  };

  const handleCheckout = async () => {
    const validLines = cart.filter(l => l.shipment_item_id && parseFloat(l.qty) > 0 && parseFloat(l.price) > 0);
    if (validLines.length === 0) { showToast('الفاتورة فارغة أو مكتملة البيانات', 'info'); return; }
    if (payType === 'credit' && !selectedCustomer) { showToast('اختر التاجر للبيع الآجل', 'info'); return; }
    try {
      await createSale({
        payment_type: payType,
        customer: selectedCustomer?.id || null,
        currency_code: currencyCode,
        exchange_rate: currencyCode === 'ILS' ? 1 : (parseFloat(exchangeRate) || 1),
        discount: invoiceDiscount,
        items: validLines.map(l => ({
          shipment_item: l.shipment_item_id,
          quantity: parseFloat(l.qty) || 0,
          unit_price: parseFloat(l.price) || 0,
          commission_rate: parseFloat(l.commission_rate) || 0,
          discount: parseFloat(l.discount) || 0,
          gross_weight: parseFloat(l.gross_weight) || 0,
          net_weight: parseFloat(l.net_weight) || 0,
          has_empties: l.has_empties,
          empties_count: parseInt(l.empties_count) || 0,
          containers_out: parseInt(l.empties_count) || 0
        })),
      }).unwrap();
      showToast('تم حفظ الفاتورة بنجاح', 'success');
      clearCart();
    } catch (err: any) {
      console.error(err);
      if (err?.data && !err?.data?.detail) {
         // Extract DRF field errors
         const errorMsgs = Object.entries(err.data).map(([k, v]) => {
            if (Array.isArray(v)) {
               if (typeof v[0] === 'object') return `${k}: مراجعة بيانات السطور`;
               return `${k}: ${v.join(', ')}`;
            }
            return `${k}: ${v}`;
         }).join(' | ');
         showToast(errorMsgs, 'error');
      } else {
         showToast(err?.data?.detail || 'حدث خطأ غير متوقع بالخادم', 'error');
      }
    }
  };

  const clearCart = () => {
    setCart([{ ...emptyLine }]);
    setInvoiceDiscount(0);
    setAmountReceived(0);
    setSelectedCustomer(null);
  };

  if (loadingShipments) return <VegetableLoader text="جاري تجهيز نقطة البيع..." fullScreen />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', direction: 'rtl', overflow: 'hidden' }}>
       {/* ── Top Bar ── */}
       <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', background: '#e4e4e7', padding:'5px', borderRadius: '12px' }}>
             <button onClick={()=>setPayType('cash')} style={{ background: payType==='cash'?'#059669':'transparent', color: payType==='cash'?'white':'#52525b', padding: '8px 24px', borderRadius: '8px', fontWeight: 900 }}>نقدي (Cash)</button>
             <button onClick={()=>setPayType('credit')} style={{ background: payType==='credit'?'#059669':'transparent', color: payType==='credit'?'white':'#52525b', padding: '8px 24px', borderRadius: '8px', fontWeight: 900 }}>آجل (Credit)</button>
          </div>
          <div style={{ width: '190px' }}>
            <select
              value={currencyCode}
              onChange={handleCurrencySelect}
              style={{ width: '100%', height: '46px', borderRadius: '12px', background: '#e4e4e7', padding: '0 12px', fontWeight: 900, outline: 'none', border: '0' }}
            >
              <option value="ILS">ILS ₪</option>
              <option value="USD">USD $</option>
              <option value="JOD">JOD</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
             <SmartSearch
                onSearch={async (q) => {
                   const strippedQ = stripDiacritics(q).toLowerCase();
                   return customers.filter((c:any) => 
                      stripDiacritics(c.name).toLowerCase().includes(strippedQ) || 
                      (c.phone && c.phone.includes(q))
                   );
                }}
                placeholder="ابحث عن الزبون (اختياري للنقدي)..."
                onSelect={handleCustomerSelect}
                value={selectedCustomer ? selectedCustomer.name : undefined}
                style={{ width:'100%' }}
             />
          </div>
       </div>

       {/* ── Main Grid ── */}
       <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #e4e4e7' }}>
          <div style={{ overflowX: 'auto', flex: 1 }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: '#f4f4f5', fontSize: '13px', color: '#52525b' }}>
                   <tr>
                      <th style={{ padding: '10px', width: '40px' }}>#</th>
                      <th style={{ padding: '10px', minWidth: '160px' }}>الصنف</th>
                      <th style={{ padding: '10px', width: '80px' }}>العدد</th>
                      <th style={{ padding: '10px', width: '80px' }}>الوحدة</th>
                      <th style={{ padding: '10px', width: '80px' }}>القائم</th>
                      <th style={{ padding: '10px', width: '80px' }}>الفارغ</th>
                      <th style={{ padding: '10px', width: '90px' }}>الصافي</th>
                      <th style={{ padding: '10px', width: '90px' }}>السعر</th>
                      <th style={{ padding: '10px', width: '80px' }}>الكميسيون</th>
                      <th style={{ padding: '10px', width: '80px' }}>الخصم</th>
                      <th style={{ padding: '10px', width: '100px' }}>يوجد فوارغ؟</th>
                      <th style={{ padding: '10px', width: '120px' }}>إجمالي (الإسترشادي)</th>
                   </tr>
                </thead>
                <tbody>
                   {cart.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                         <td style={{ padding: '8px', fontWeight: 900, color: '#a1a1aa', textAlign: 'center' }}>
                            {idx + 1}
                         </td>
                         <td style={{ padding: '4px' }}>
                            {line.shipment_item_id ? (
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '6px 10px', borderRadius: '8px' }}>
                                  <span style={{ fontWeight: 900, fontSize: '13px', color: '#065f46' }}>{line.item_name} <span style={{ fontSize: '11px', color: '#10b981' }}>({line.supplier_name})</span></span>
                                  <button onClick={() => { const nc = [...cart]; nc[idx] = {...emptyLine}; setCart(nc); }} style={{ color: '#ef4444', fontWeight: 900 }}>✕</button>
                               </div>
                            ) : (
                               <SmartSearch 
                                 id={`cart-${idx}-item_search`}
                                 onSearch={async (q) => catalogList.filter((c:any) => c.item_name.toLowerCase().includes(stripDiacritics(q).toLowerCase()))}
                                 getLabel={(item: any) => item.item_name}
                                 placeholder="ابحث عن الصنف..."
                                 onSelect={(cItem: any) => {
                                    if (cItem && cItem.shipment_items.length > 0) {
                                      const shp = cItem.shipment_items[0];
                                      setCart(prev => {
                                        const next = [...prev];
                                        next[idx] = {
                                          ...next[idx],
                                          shipment_item_id: shp.id,
                                          item_name: shp.item_name,
                                          supplier_name: shp.supplier_name,
                                          unit: shp.unit || 'صندوق',
                                          price: cItem.best_price ? cItem.best_price.toString() : '',
                                          tare_per_unit: cItem.tare_weight,
                                          price_on: cItem.price_on,
                                        };
                                        return next;
                                      });
                                      setTimeout(() => {
                                        document.getElementById(`cart-${idx}-qty`)?.focus();
                                      }, 0);
                                    }
                                  }}
                                 style={{ width: '100%' }}
                               />
                            )}
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-qty`} value={line.qty} onChange={(e)=>updateLine(idx,'qty',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'qty')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} inputMode="numeric" pattern="[0-9]*" dir="ltr" />
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-unit`} value={line.unit} onChange={(e)=>updateLine(idx,'unit',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'unit')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} />
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-gross_weight`} value={line.gross_weight} onChange={(e)=>updateLine(idx,'gross_weight',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'gross_weight')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} inputMode="numeric" pattern="[0-9.]*" dir="ltr" />
                         </td>
                         <td style={{ padding: '4px', textAlign: 'center', fontWeight: 900, color: '#ef4444', background: '#fee2e2' }}>
                            {line.tare_weight}
                         </td>
                         <td style={{ padding: '4px', textAlign: 'center', fontWeight: 900, color: '#10b981', background: '#d1fae5' }}>
                            {line.net_weight}
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-price`} value={line.price} onChange={(e)=>updateLine(idx,'price',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'price')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900, color: '#059669' }} inputMode="numeric" pattern="[0-9.]*" dir="ltr" />
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-commission_rate`} value={line.commission_rate} onChange={(e)=>updateLine(idx,'commission_rate',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'commission_rate')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} inputMode="numeric" pattern="[0-9.]*" dir="ltr" />
                         </td>
                         <td style={{ padding: '4px' }}>
                            <input id={`cart-${idx}-discount`} value={line.discount} onChange={(e)=>updateLine(idx,'discount',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'discount')} style={{ width: '100%', padding: '8px', border: '1px solid #e4e4e7', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} inputMode="numeric" pattern="[0-9.]*" dir="ltr" />
                         </td>
                         <td style={{ padding: '4px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                               <input id={`cart-${idx}-has_empties`} type="checkbox" checked={line.has_empties} onKeyDown={(e)=>handleKeyDown(e,idx,'has_empties')} onChange={(e)=>{ updateLine(idx,'has_empties',e.target.checked); if(e.target.checked) setTimeout(()=> document.getElementById(`cart-${idx}-empties_count`)?.focus(), 50); }} style={{ width: '20px', height: '20px' }} />
                               {line.has_empties && (
                                  <input id={`cart-${idx}-empties_count`} value={line.empties_count} onChange={(e)=>updateLine(idx,'empties_count',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'empties_count')} placeholder="عدد" style={{ width: '50px', padding: '4px', border: '1px solid #e4e4e7', borderRadius: '4px', textAlign: 'center', fontWeight: 900, fontSize: '11px' }} inputMode="numeric" pattern="[0-9]*" dir="ltr" />
                               )}
                            </div>
                         </td>
                         <td style={{ padding: '4px', textAlign: 'center', fontWeight: 900, color: '#0f766e', fontSize: '14px' }}>
                            {line.shipment_item_id ? getSubtotal(line).toFixed(2) : ''}
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div style={{ padding: '20px', background: '#fafafa', borderTop: '2px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', gap: '30px', alignItems: 'center', fontWeight: 900 }}>
                <div>الإجمالي: <span style={{ color: '#059669', fontSize: '18px' }} dir="ltr">{subtotal.toLocaleString()} ₪</span></div>
                
                {totalCommission > 0 && (
                   <div>العمولة: <span style={{ color: '#0f766e', fontSize: '18px' }} dir="ltr">{totalCommission.toLocaleString()} ₪</span></div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', padding: '5px 15px', borderRadius: '10px' }}>
                   <span style={{ fontSize: '13px' }}>خصم إضافي:</span>
                   <input 
                      type="number" 
                      value={invoiceDiscount} 
                      onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                      style={{ width: '80px', padding: '5px', border: '1px solid #ef4444', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }}
                      dir="ltr"
                   />
                </div>

                <div>صافي الفاتورة: <span style={{ color: '#0f766e', fontSize: '24px' }} dir="ltr">{netTotal.toLocaleString()} ₪</span></div>
             </div>
             <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={handleSaveDraft} style={{ background: '#f59e0b', color: 'white', padding: '12px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '16px' }}>
                   حفظ مسودة <span style={{ background: 'rgba(255,255,255,0.2)', padding:'2px 6px', borderRadius:'4px', fontSize:'11px', marginLeft:'5px' }}>F2</span>
                </button>
                <button onClick={handleCheckout} style={{ background: '#059669', color: 'white', padding: '12px 30px', borderRadius: '12px', fontWeight: 900, fontSize: '16px', boxShadow: '0 10px 25px rgba(5,150,105,0.2)' }}>
                   ترحيل הפاتورة <span style={{ background: 'rgba(255,255,255,0.2)', padding:'2px 6px', borderRadius:'4px', fontSize:'11px', marginLeft:'5px' }}>F10</span>
                </button>
                <button onClick={clearCart} style={{ background: '#fff', color: '#ef4444', border: '1px solid #ef4444', padding: '12px 20px', borderRadius: '12px', fontWeight: 900 }}>
                   إلغاء <span style={{ background: '#fee2e2', padding:'2px 6px', borderRadius:'4px', fontSize:'11px', marginLeft:'5px' }}>Esc</span>
                </button>
             </div>
          </div>
       </div>

       {showExchangeModal && (
         <div className="fixed inset-0 z-[3000] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 border border-zinc-200" dir="rtl">
               <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">currency_exchange</span>
                  تحويل العملة ({pendingCurrency})
               </h3>
               <p className="text-zinc-500 text-sm mb-4 font-bold">يرجى إدخال سعر الصرف الحالي مقابل العملة الأساسية (ILS الشيكل).</p>
               
               <div className="mb-6">
                  <label className="text-sm font-bold text-zinc-700 block mb-2">سعر الصرف (كل 1 {pendingCurrency} = X شيكل)</label>
                  <input type="number" step="0.01" value={exchangeRate} onChange={(e)=>setExchangeRate(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl outline-none font-code text-2xl text-center text-emerald-600 font-black" autoFocus />
               </div>

               <div className="bg-emerald-50 rounded-lg p-3 mb-6 text-sm text-emerald-800 font-bold flex flex-col items-center">
                  <div>100.00 {pendingCurrency} ستمثل:</div>
                  <div className="text-2xl font-black font-code mt-1" dir="ltr">
                     {(100 * (parseFloat(exchangeRate) || 1)).toFixed(2)} ILS
                  </div>
               </div>

               <div className="flex gap-4">
                  <button 
                    onClick={() => {
                       setCurrencyCode(pendingCurrency);
                       setShowExchangeModal(false);
                    }} 
                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 cursor-pointer"
                  >
                    اعتماد السعر ({exchangeRate})
                  </button>
                  <button 
                    onClick={() => {
                       setPendingCurrency('ILS');
                       setShowExchangeModal(false);
                    }} 
                    className="py-3 px-6 bg-white border border-zinc-200 font-bold rounded-lg text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}
