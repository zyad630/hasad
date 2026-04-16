import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';
import { SmartSearch } from '../../components/ui/SmartSearch';
import { formatDateDisplay } from '../../utils/dateUtils';

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
    getSuppliers: build.query({ 
      query: (params: any) => ({ url: 'suppliers/', params: params && typeof params === 'object' ? params : (params ? { search: params } : {}) }),
      providesTags: ['Suppliers'] 
    }),
    getGlobalUnits: build.query({ query: () => 'global-units/', providesTags: ['GlobalUnits'] }),
    createSale: build.mutation({
      query: (body) => ({ url: 'sales/', method: 'POST', body }),
      invalidatesTags: ['Shipments', 'Customers', 'Sales', 'Suppliers'],
    }),
    getInvoiceDetail: build.query({ 
      query: (id: string) => `sales/${id}/full-detail/`, 
      providesTags: (result, error, id) => [{ type: 'Sales', id }] 
    }),
    editInvoice: build.mutation({ 
      query: ({ id, data }) => ({ url: `sales/${id}/edit/`, method: 'PATCH', body: data }), 
      invalidatesTags: ['Sales', 'Shipments'] 
    }),
    searchParties: build.query({
      query: (q) => `reports/search-parties/?q=${encodeURIComponent(q)}`,
    }),
  }),
});

export const {
  useGetOpenShipmentsQuery, useGetAllItemsQuery,
  useGetCustomersQuery, useGetSuppliersQuery, useGetGlobalUnitsQuery, useCreateSaleMutation,
  useGetInvoiceDetailQuery, useEditInvoiceMutation,
  useSearchPartiesQuery,
} = posApi;

interface CartLine {
  shipment_item_id: string;
  item_name: string;
  supplier_name: string;
  unit: string;
  qty: string;
  gross_weight: string;
  tare_weight: string; // Changed to string for input consistency
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
  // Market Fees
  loading_fee: string;
  unloading_fee: string;
  floor_fee: string;
  delivery_fee: string;
}

export default function POSPage() {
  const { showToast } = useToast();
  const { data: shipments, isLoading: loadingShipments } = useGetOpenShipmentsQuery({});
  const { data: allItemsRaw } = useGetAllItemsQuery({});
  const { data: globalUnitsRaw } = useGetGlobalUnitsQuery({});
  const [createSale, { isLoading: saving }] = useCreateSaleMutation();
  const [triggerSearchParties] = posApi.useLazySearchPartiesQuery();

  const globalUnits = globalUnitsRaw?.results || (Array.isArray(globalUnitsRaw) ? globalUnitsRaw : []);
  
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDateFocused, setIsDateFocused] = useState(false);
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [currencyCode, setCurrencyCode] = useState('ILS');

  const [showRecentSids, setShowRecentSids] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

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

  const createEmptyLine = useCallback((customer?: any): CartLine => ({
    shipment_item_id: '',
    item_name: '',
    supplier_name: '',
    unit: 'صندوق',
    qty: '',
    gross_weight: '',
    tare_weight: '0',
    net_weight: '',
    price: '',
    price_on: 'net',
    commission_rate: customer?.effective_commission_rate ? String(customer.effective_commission_rate.rate) : '0',
    commission_basis: 'AMOUNT',
    commission_calc_type: customer?.effective_commission_rate?.calc_type || 'percent',
    discount: '0',
    has_empties: false,
    empties_count: '',
    tare_per_unit: 0,
    loading_fee: '0',
    unloading_fee: '0',
    floor_fee: '0',
    delivery_fee: '0'
  }), []);

  const [cart, setCart] = useState<CartLine[]>([ createEmptyLine() ]);

  const updateMultipleFields = useCallback((index: number, updates: Partial<CartLine>) => {
    setCart(prev => {
      const newCart = [...prev];
      const currentLine = { ...newCart[index], ...updates };
      
      const q = parseFloat(currentLine.qty) || 0;
      const g = parseFloat(currentLine.gross_weight) || 0;
      const tpu = currentLine.tare_per_unit || 0;

      // Only auto-recalculate tare_weight if qty or tare_per_unit changed
      if (updates.qty !== undefined || updates.tare_per_unit !== undefined) {
         const t = q * tpu;
         currentLine.tare_weight = t > 0 ? t.toString() : '0';
      }

      let tare_total = parseFloat(currentLine.tare_weight) || 0;
      if (g > 0) {
         currentLine.net_weight = Math.max(0, g - tare_total).toString();
      } else {
         currentLine.net_weight = '';
      }

      newCart[index] = currentLine;
      return newCart;
    });
  }, []);

  const updateLine = useCallback((index: number, field: keyof CartLine, value: any) => {
    updateMultipleFields(index, { [field]: value });
  }, [updateMultipleFields]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Special handling for item_search: if Enter is pressed and we have a name but no ID, try to resolve it now
      if (field === 'item_search' && !cart[index].shipment_item_id && cart[index].item_name) {
         const match = catalogList.find((it: any) => it.item_name === cart[index].item_name.trim());
         if (match && match.shipment_items.length > 0) {
            const shp = match.shipment_items[0];
            updateMultipleFields(index, {
               shipment_item_id: shp.id,
               item_name: shp.item_name,
               supplier_name: shp.supplier_name,
               unit: match.base_unit || 'صندوق',
               price: match.best_price ? match.best_price.toString() : cart[index].price,
               tare_per_unit: match.tare_weight,
               price_on: match.price_on
            });
         }
      }
      const flow = ['qty', 'unit', 'gross_weight', 'tare_weight', 'price', 'commission_rate', 'discount', 'loading_fee', 'unloading_fee', 'floor_fee', 'has_empties'];
      if(cart[index].has_empties) flow.push('empties_count');

      const currentIndex = flow.indexOf(field);
      if (currentIndex > -1 && currentIndex < flow.length - 1) {
         const nextField = flow[currentIndex + 1];
         setTimeout(() => {
            const el = document.getElementById(`cart-${index}-${nextField}`);
            if (el) {
                el.focus();
                if (el instanceof HTMLInputElement) el.select();
            }
         }, 10);
      } else if (currentIndex === flow.length - 1 || field === 'item_search') {
         // Resolve flow index logic: if current is last or we are jumping from search to qty
         const targetField = field === 'item_search' ? 'qty' : null;
         
         if (targetField) {
            setTimeout(() => document.getElementById(`cart-${index}-${targetField}`)?.focus(), 10);
         } else if (index === cart.length - 1) {
            const newLine = createEmptyLine(selectedCustomer);
            newLine.commission_rate = cart[index].commission_rate;
            newLine.commission_calc_type = cart[index].commission_calc_type;
            setCart([...cart, newLine]);
            setTimeout(() => {
              document.getElementById(`${index + 1}-item_search`)?.focus();
            }, 50);
         } else {
            document.getElementById(`${index + 1}-item_search`)?.focus();
         }
      }
    }
  };

  const shipmentItems = React.useMemo(() => (shipments || [] as any[]).flatMap((s: any) =>
    (s.items || []).map((si: any) => ({
      ...si,
      shp_id: s.id,
      supplier_name: s.supplier_name,
      remaining_qty_num: Number(si.remaining_qty) || 0,
    }))
  ), [shipments]);

  const allItems = React.useMemo(() => allItemsRaw?.results || (Array.isArray(allItemsRaw) ? allItemsRaw : []), [allItemsRaw]);
  
  const catalogList = React.useMemo(() => {
    const list: any[] = [];
    const itemsMap = new Map();
    
    (allItems as any[]).forEach((item: any) => {
      const key = (item.name || '').trim();
      itemsMap.set(key, { ...item });
    });

    shipmentItems.forEach((si: any) => {
      const key = (si.item_name || '').trim();
      const baseItem = itemsMap.get(key) || {};
      list.push({
        ...si,
        item_name: key, // Allow exact matching by item name to pick the first one automatically
        search_label: `${key} - المزارع: ${si.supplier_name.split(' ')[0]} (${si.remaining_qty_num})`,
        tare_weight: Number(baseItem.tare_weight) || 0,
        price_on: baseItem.price_on || 'net',
        base_unit: si.unit || baseItem.base_unit || 'صندوق',
        best_price: Number(si.expected_price) || 0,
        shipment_items: [si],
      });
    });

    return list;
  }, [allItems, shipmentItems]);

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

  const { subtotal, totalCommission, lineDiscounts, netTotal, change } = React.useMemo(() => {
    const sub = cart.reduce((s, l) => l.item_name ? s + getSubtotal(l) : s, 0);
    const comm = cart.reduce((s, l) => l.item_name ? s + (getCommissionAmount(l) || 0) : s, 0);
    const disc = cart.reduce((s, l) => l.item_name ? s + (parseFloat(l.discount)||0) : s, 0);
    const net = sub + comm - disc - invoiceDiscount;
    const chg = amountReceived > 0 ? amountReceived - net : 0;
    return { subtotal: sub, totalCommission: comm, lineDiscounts: disc, netTotal: net, change: chg };
  }, [cart, invoiceDiscount, amountReceived]);

  const handleSaveDraft = () => {
     if (cart.length === 1 && !cart[0].shipment_item_id) return;
     showToast('تم حفظ الفاتورة كمسودة مؤقتاً', 'success');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input/select/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'F2') { e.preventDefault(); handleSaveDraft(); }
      if (e.key === 'F10') { e.preventDefault(); handleCheckout(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, payType, selectedCustomer, invoiceDiscount, amountReceived]);

  // Request C: Auto load commission when picking customer
  const handleCustomerSelect = (cust: any) => {
     setSelectedCustomer(cust);
     if (!cust) return;

     const type = cust.effective_commission_rate?.calc_type || "percent";
     const normalizedRate = cust.effective_commission_rate ? cust.effective_commission_rate.rate : 0;

     const newCart = cart.map((c) => ({
        ...c,
        commission_rate: String(normalizedRate),
        commission_basis: "AMOUNT",
        commission_calc_type: type,
     }));
     setCart(newCart);
  };


  const handleCheckout = async () => {
    // 0. Automatically clean up completely empty lines before any validation
    const activeCart = cart.filter(l => l.item_name || l.shipment_item_id || l.qty || l.price);
    
    // Immediately remove empty lines from UI so they don't persist
    setCart(activeCart.length > 0 ? activeCart : [createEmptyLine(selectedCustomer)]);

    if (activeCart.length === 0) {
       showToast('يرجى إدخال صنف واحد على الأقل', 'info');
       return;
    }

    // 1. Auto-resolve items that were typed but not explicitly 'clicked' from the search list
    const updatedCart = activeCart.map(line => {
      if (!line.shipment_item_id && line.item_name) {
        // Try to find a match in the catalog that HAS a shipment
        const cleanSearch = stripDiacritics(line.item_name.trim()).toLowerCase();
        let match = catalogList.find((it: any) => stripDiacritics(it.item_name).toLowerCase() === cleanSearch);
        
        if (!match) {
            match = catalogList.find((it: any) => stripDiacritics(it.item_name).toLowerCase().includes(cleanSearch) || cleanSearch.includes(stripDiacritics(it.item_name).toLowerCase()));
        }

        if (match && match.shipment_items.length > 0) {
          const shp = match.shipment_items[0];
          return {
            ...line,
            shipment_item_id: shp.id,
            item_name: match.item_name, // Fix name visually
            supplier_name: shp.supplier_name,
            unit: match.base_unit || shp.unit || 'صندوق',
            price: line.price || (match.best_price ? match.best_price.toString() : ''),
            tare_per_unit: match.tare_weight,
            price_on: match.price_on || 'net',
          };
        }
      }
      return line;
    });

    // A line is valid if it has an item_id, quantity and price.
    const validLines = updatedCart.filter(l => l.shipment_item_id && (parseFloat(l.qty) > 0) && (parseFloat(l.price) > 0));
    
    if (validLines.length !== updatedCart.length) { 
      // Some lines are incomplete
      const unresolved = updatedCart.filter(l => !l.shipment_item_id && l.item_name);
      if (unresolved.length > 0) {
        showToast(`لا توجد إرسالية مفتوحة للصنف (${unresolved[0].item_name}) أو لم يتم تحديده من القائمة.`, 'error');
      } else {
        showToast('يرجى التأكد من استكمال بيانات جميع السطور (الصنف، الكمية، السعر)', 'error'); 
      }
      return; 
    }
    
    if (payType === 'credit' && !selectedCustomer) { 
      showToast('يجب اختيار الزبون لإتمام عملية البيع الآجل', 'warning'); 
      return; 
    }
    try {
      const result = await createSale({
        payment_type: payType,
        customer: selectedCustomer?.id || null,
        sale_date: saleDate,
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
          containers_out: parseInt(l.empties_count) || 0,
          loading_fee: parseFloat(l.loading_fee) || 0,
          unloading_fee: parseFloat(l.unloading_fee) || 0,
          floor_fee: parseFloat(l.floor_fee) || 0,
          delivery_fee: parseFloat(l.delivery_fee) || 0
        })),
      }).unwrap();
      showToast('تم حفظ الفاتورة بنجاح', 'success');
      setRecentSales(prev => [result, ...prev].slice(0, 10)); 
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
    // Keep payType, currencyCode, saleDate — only reset the transaction-specific fields
    setCart([createEmptyLine()]);
    setInvoiceDiscount(0);
    setAmountReceived(0);
    setSelectedCustomer(null);
  };

  if (loadingShipments) return <VegetableLoader text="جاري تجهيز نقطة البيع..." fullScreen />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', direction: 'rtl', overflow: 'hidden' }}>
       {/* ── Top Bar ── */}
       <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', padding: '0 5px' }}>
          <div style={{ display: 'flex', gap: '5px', background: '#e4e4e7', padding:'5px', borderRadius: '12px' }}>
             <button onClick={()=>setPayType('cash')} style={{ background: payType==='cash'?'#059669':'transparent', color: payType==='cash'?'white':'#52525b', padding: '8px 24px', borderRadius: '8px', fontWeight: 900 }}>نقدي (Cash)</button>
             <button onClick={()=>setPayType('credit')} style={{ background: payType==='credit'?'#059669':'transparent', color: payType==='credit'?'white':'#52525b', padding: '8px 24px', borderRadius: '8px', fontWeight: 900 }}>آجل (Credit)</button>
          </div>
          <div style={{ width: '190px' }}>
            <select value={currencyCode} onChange={handleCurrencySelect} style={{ width: '100%', height: '46px', borderRadius: '12px', background: '#e4e4e7', padding: '0 12px', fontWeight: 900, outline: 'none', border: '0' }}>
              <option value="ILS">ILS ₪</option>
              <option value="USD">USD $</option>
              <option value="JOD">JOD</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
             <SmartSearch 
               id="header-party-search"
               onSearch={async (q) => {
                  const res = await triggerSearchParties(q).unwrap();
                  return res;
               }} 
               renderItem={(item: any) => (
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900 }}>{item.name}</span>
                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>{item.type_label}</span>
                 </div>
               )}
               placeholder="ابحث عن (زبون، مزارع، موظف)..." 
               onSelect={handleCustomerSelect} 
               value={selectedCustomer ? selectedCustomer.name : ''} 
               style={{ width:'100%' }} 
             />
          </div>
          <div style={{ width: '180px' }}>
            <input id="header-sale-date" type={isDateFocused ? 'date' : 'text'} placeholder="DD/MM/YYYY" value={isDateFocused ? saleDate : formatDateDisplay(saleDate)} onChange={(e) => setSaleDate(e.target.value)} onFocus={() => setIsDateFocused(true)} onBlur={() => setIsDateFocused(false)} style={{ width: '100%', height: '46px', borderRadius: '12px', background: '#e4e4e7', padding: '0 12px', fontWeight: 900, outline: 'none', border: '0', textAlign: 'center' }} />
          </div>
          <button 
             onClick={() => setShowRecentSids(true)}
             style={{ height: '46px', padding: '0 20px', background: '#f8fafc', color: '#475569', border: '2px solid #e2e8f0', borderRadius: '12px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
             <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>history</span>
             آخر الفواتير
          </button>
       </div>

       {/* ── Main Layout (Grid + Sidebar) ── */}
       <div style={{ position: 'relative', display: 'flex', flex: 1, gap: '15px', overflow: 'hidden' }}>
          {/* Main Sales Grid */}
          <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #e4e4e7' }}>
             <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                   <thead style={{ background: '#f4f4f5', fontSize: '11px', color: '#52525b' }}>
                      <tr>
                         <th style={{ padding: '8px', width: '30px' }}>#</th>
                         <th style={{ padding: '8px', minWidth: '150px' }}>الصنف والمزارع</th>
                         <th style={{ padding: '8px', width: '60px' }}>العدد</th>
                         <th style={{ padding: '8px', width: '70px' }}>الوحدة</th>
                         <th style={{ padding: '8px', width: '60px' }}>القائم</th>
                         <th style={{ padding: '8px', width: '60px' }}>الفارغ</th>
                         <th style={{ padding: '8px', width: '60px' }}>الصافي</th>
                         <th style={{ padding: '8px', width: '70px' }}>السعر</th>
                         <th style={{ padding: '8px', width: '60px' }}>الكميسيون</th>
                         <th style={{ padding: '8px', width: '60px' }}>خصم</th>
                         <th style={{ padding: '8px', width: '40px' }}>تحميل</th>
                         <th style={{ padding: '8px', width: '40px' }}>تنزيل</th>
                         <th style={{ padding: '8px', width: '40px' }}>أرضية</th>
                         <th style={{ padding: '8px', width: '70px' }}>فوارغ?</th>
                         <th style={{ padding: '8px', width: '90px' }}>الإجمالي</th>
                      </tr>
                   </thead>
                   <tbody>
                      {cart.map((line, idx) => (
                         <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '8px', fontWeight: 900, color: '#a1a1aa', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ padding: '4px' }}>
                               {line.shipment_item_id ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '6px 10px', borderRadius: '8px' }}>
                                     <span style={{ fontWeight: 900, fontSize: '12px', color: '#065f46' }}>{line.item_name} <span style={{ fontSize: '10px', color: '#10b981' }}>({line.supplier_name})</span></span>
                                     <button onClick={() => { const nc=[...cart]; nc[idx]=createEmptyLine(selectedCustomer); setCart(nc); }} style={{ color: '#ef4444' }}>✕</button>
                                  </div>
                               ) : (
                                  <SmartSearch id={`${idx}-item_search`} onSearch={async (q) => { const nextCart = cart.map((c, i) => i === idx ? { ...c, item_name: q } : c); setCart(nextCart); return catalogList; }} getLabel={(item: any) => item.search_label || item.item_name} renderItem={(item: any) => ( <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}> <span>{item.search_label || item.item_name}</span> </div> )} value={line.item_name} placeholder="..." onSelect={(cItem: any) => { if (!cItem) return; const updates: Partial<CartLine> = { item_name: cItem.item_name, unit: cItem.base_unit || cItem.unit || 'صندوق', price: cItem.best_price ? cItem.best_price.toString() : line.price, tare_per_unit: Number(cItem.tare_weight) || 0, price_on: cItem.price_on || 'net', shipment_item_id: '', supplier_name: '' }; if (cItem.shipment_items && cItem.shipment_items.length > 0) { const shp = cItem.shipment_items[0]; updates.shipment_item_id = String(shp.id); updates.supplier_name = String(shp.supplier_name); } else if (cItem.id) { updates.shipment_item_id = String(cItem.id); updates.supplier_name = String(cItem.supplier_name || ''); } updateMultipleFields(idx, updates); setTimeout(() => document.getElementById(`cart-${idx}-qty`)?.focus(), 10); }} />
                               )}
                            </td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-qty`} value={line.qty} onChange={(e)=>updateLine(idx,'qty',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'qty')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-unit`} list="global-units-list" value={line.unit} onChange={(e)=>updateLine(idx,'unit',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'unit')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-gross_weight`} value={line.gross_weight} onChange={(e)=>updateLine(idx,'gross_weight',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'gross_weight')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-tare_weight`} value={line.tare_weight} onChange={(e)=>updateLine(idx,'tare_weight',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'tare_weight')} style={{ width: '100%', padding: '6px', border: '1px solid #fee', color: '#900', background: '#fff1f1', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700 }}>{line.net_weight}</td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-price`} value={line.price} onChange={(e)=>updateLine(idx,'price',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'price')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center', color: '#059669', fontWeight: 900 }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-commission_rate`} value={line.commission_rate} onChange={(e)=>updateLine(idx,'commission_rate',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'commission_rate')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-discount`} value={line.discount} onChange={(e)=>updateLine(idx,'discount',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'discount')} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-loading_fee`} value={line.loading_fee} onChange={(e)=>updateLine(idx,'loading_fee',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'loading_fee')} style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-unloading_fee`} value={line.unloading_fee} onChange={(e)=>updateLine(idx,'unloading_fee',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'unloading_fee')} style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}><input id={`cart-${idx}-floor_fee`} value={line.floor_fee} onChange={(e)=>updateLine(idx,'floor_fee',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'floor_fee')} style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }} /></td>
                            <td style={{ padding: '4px' }}>
                               <div style={{ display: 'flex', gap: '2px' }}>
                                  <input id={`cart-${idx}-has_empties`} type="checkbox" checked={line.has_empties} onChange={(e)=>updateLine(idx,'has_empties',e.target.checked)} onKeyDown={(e)=>handleKeyDown(e,idx,'has_empties')} />
                                  {line.has_empties && <input id={`cart-${idx}-empties_count`} value={line.empties_count} onChange={(e)=>updateLine(idx,'empties_count',e.target.value)} onKeyDown={(e)=>handleKeyDown(e,idx,'empties_count')} style={{ width: '35px', padding: '2px' }} />}
                               </div>
                            </td>
                            <td style={{ padding: '4px', textAlign: 'left', fontWeight: 900, color: '#0f766e' }}>{line.item_name ? getSubtotal(line).toFixed(2) : ''}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             <div style={{ padding: '15px 20px', background: '#fafafa', borderTop: '2px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center', fontWeight: 900 }}>
                   <div style={{ fontSize: '13px' }}>الإجمالي: <span style={{ color: '#059669', fontSize: '18px' }}>{subtotal.toLocaleString()} ₪</span></div>
                   {totalCommission > 0 && <div style={{ fontSize: '13px' }}>العمولة: <span style={{ color: '#0f766e', fontSize: '18px' }}>{totalCommission.toLocaleString()} ₪</span></div>}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', padding: '5px 15px', borderRadius: '10px' }}>
                      <span style={{ fontSize: '12px' }}>خصم إضافي:</span>
                      <input type="number" value={invoiceDiscount} onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)} style={{ width: '80px', padding: '5px', border: '1px solid #ef4444', borderRadius: '6px', textAlign: 'center', fontWeight: 900 }} dir="ltr" />
                   </div>
                   <div style={{ fontSize: '14px' }}>الصافي: <span style={{ color: '#0f766e', fontSize: '24px' }}>{netTotal.toLocaleString()} {currencyCode}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                   <button onClick={() => { if (window.confirm('مسح الفاتورة الحالية؟')) clearCart(); }} disabled={saving} style={{ background: '#dc2626', color: 'white', padding: '10px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>🗑 مسح</button>
                   <button onClick={() => { window.location.href = '/'; }} disabled={saving} style={{ background: '#64748b', color: 'white', padding: '10px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>❌ إلغاء (رجوع)</button>
                   <button onClick={handleSaveDraft} disabled={saving} style={{ background: '#f59e0b', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, opacity: saving ? 0.6 : 1 }}>مسودة</button>
                   <button onClick={handleCheckout} disabled={saving} style={{ background: saving ? '#94a3b8' : '#059669', color: 'white', padding: '10px 25px', borderRadius: '10px', fontWeight: 900, fontSize: '16px', boxShadow: saving ? 'none' : '0 5px 15px rgba(5,150,105,0.2)', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>{saving ? '⏳ جاري الترحيل...' : 'ترحيل (F10)'}</button>
                </div>
             </div>
          </div>

          {/* Overlay Background for Drawer */}
          {showRecentSids && (
              <div 
                 onClick={() => setShowRecentSids(false)}
                 style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 40 }}
              />
          )}

          {/* Sidebar Drawer */}
          <div style={{ 
             position: 'absolute', 
             left: showRecentSids ? '0' : '-350px', 
             top: '0', 
             bottom: '0', 
             width: '320px', 
             zIndex: 50,
             background: 'white', 
             boxShadow: '4px 0 25px rgba(0,0,0,0.1)',
             transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
             display: 'flex', 
             flexDirection: 'column' 
          }}>
             <div style={{ padding: '20px', fontWeight: 900, borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>history</span>
                    <span style={{ fontSize: '15px' }}>آخر الفواتير (السجل)</span>
                </div>
                <button onClick={()=>setShowRecentSids(false)} style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}>✕</button>
             </div>
             <div style={{ flex: 1, overflowY: 'auto' }}>
                {recentSales.map(s => (
                   <div key={s.id} style={{ padding: '15px 20px', borderBottom: '1px solid #f8fafc', background: 'white', cursor: 'pointer', transition: 'background 0.2s' }} onClick={()=>setEditingInvoiceId(s.id)} onMouseEnter={(e)=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={(e)=>e.currentTarget.style.background='white'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                         <span style={{ fontWeight: 900, color: '#334155', fontSize: '14px' }}>{s.customer_name || 'نقدي عام'}</span>
                         <span style={{ color: '#059669', fontWeight: 900, fontSize: '14px' }}>{parseFloat(s.foreign_amount).toFixed(2)} {s.currency_code}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>receipt</span>
                             #{s.id.slice(-6)}
                         </span>
                         <span style={{ color: '#6366f1', fontWeight: 700, background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>تعديل وتفاصيل</span>
                      </div>
                   </div>
                ))}
                {recentSales.length === 0 && <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 700 }}>لا توجد فواتير مؤخراً في هذه الجلسة</div>}
             </div>
          </div>
       </div>

       {editingInvoiceId && <EditInvoiceModalFromPOS id={editingInvoiceId} onClose={()=>setEditingInvoiceId(null)} customers={customers} onSave={()=>{ setEditingInvoiceId(null); showToast('تم تحديث الفاتورة', 'success'); }} />}

       {showExchangeModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ background: 'white', padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '100%', direction: 'rtl' }}>
                <h3 style={{ margin: '0 0 15px', fontWeight: 900 }}>العملة ({pendingCurrency})</h3>
                <input type="number" value={exchangeRate} onChange={(e)=>setExchangeRate(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e4e4e7', borderRadius: '8px', fontSize: '20px', fontWeight: 900, textAlign: 'center' }} autoFocus />
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                   <button onClick={()=>{ setCurrencyCode(pendingCurrency); setShowExchangeModal(false); }} style={{ flex: 1, padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900 }}>تأكيد</button>
                   <button onClick={()=>setShowExchangeModal(false)} style={{ flex: 1, padding: '12px', background: '#f4f4f5', border: 'none', borderRadius: '10px', fontWeight: 900 }}>إلغاء</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}

function EditInvoiceModalFromPOS({ id, onClose, customers, onSave }: any) {
  const { data: inv, isLoading } = useGetInvoiceDetailQuery(id);
  const [editInvoice, { isLoading: isSaving }] = useEditInvoiceMutation();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (inv) {
      setForm({
        customer: inv.customer || '',
        payment_type: inv.payment_type || 'cash',
        currency_code: inv.currency_code || 'ILS',
        exchange_rate: inv.exchange_rate || '1.0',
        reason: 'تعديل سريع من POS',
        items: (inv.lines || inv.items || []).map((l: any) => ({
          ...l,
          quantity: l.quantity,
          unit_price: l.unit_price,
          net_weight: l.net_weight,
          gross_weight: l.gross_weight,
          subtotal: l.subtotal,
          loading_fee: l.loading_fee,
          unloading_fee: l.unloading_fee,
          floor_fee: l.floor_fee,
          delivery_fee: l.delivery_fee,
        })),
      });
    }
  }, [inv]);

  if (isLoading || !form) return <VegetableLoader text="جاري تحميل الفاتورة..." />;

  const handleSave = async () => {
    try {
      await editInvoice({ id, data: form }).unwrap();
      onSave();
    } catch (e: any) { alert(e?.data?.error || 'خطأ في التعديل'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '800px', width: '100%', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontWeight: 900, marginBottom: '20px' }}>تعديل فاتورة مرحّلة</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <div style={{ flex: 1 }}><label style={{ fontSize: '11px' }}>الزبون</label>
             <select value={form.customer} onChange={e=>setForm({...form, customer:e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '8px' }}>
               <option value="">نقدي</option>{customers.map((c: any)=><option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
           </div>
           <div style={{ flex: 2 }}><label style={{ fontSize: '11px' }}>السبب</label><input value={form.reason} onChange={e=>setForm({...form, reason:e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '8px' }} /></div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead style={{ background: '#f8fafc' }}>
             <tr>
               {['صنف', 'عدد', 'وزن صافي', 'سعر', 'تحميل', 'تنزيل', 'أرضية', 'إجمالي'].map(h=><th key={h} style={{ textAlign: 'right', padding: '10px', fontSize: '11px' }}>{h}</th>)}
             </tr>
           </thead>
           <tbody>{form.items.map((line: any, idx: number)=>(
             <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
               <td style={{ padding: '10px', fontSize: '12px', fontWeight: 700 }}>{line.item_name}</td>
               <td><input type="number" value={line.quantity} onChange={e=>{ const ni=[...form.items]; ni[idx].quantity=e.target.value; setForm({...form, items:ni}); }} style={{ width: '45px', padding: '4px' }} /></td>
               <td><input type="number" value={line.net_weight} onChange={e=>{ const ni=[...form.items]; ni[idx].net_weight=e.target.value; ni[idx].subtotal=(parseFloat(e.target.value)*parseFloat(ni[idx].unit_price)).toFixed(2); setForm({...form, items:ni}); }} style={{ width: '55px', padding: '4px' }} /></td>
               <td><input type="number" value={line.unit_price} onChange={e=>{ const ni=[...form.items]; ni[idx].unit_price=e.target.value; ni[idx].subtotal=(parseFloat(ni[idx].net_weight || ni[idx].quantity)*parseFloat(e.target.value)).toFixed(2); setForm({...form, items:ni}); }} style={{ width: '55px', padding: '4px' }} /></td>
               <td><input type="number" value={line.loading_fee} onChange={e=>{ const ni=[...form.items]; ni[idx].loading_fee=e.target.value; setForm({...form, items:ni}); }} style={{ width: '45px', padding: '4px' }} /></td>
               <td><input type="number" value={line.unloading_fee} onChange={e=>{ const ni=[...form.items]; ni[idx].unloading_fee=e.target.value; setForm({...form, items:ni}); }} style={{ width: '45px', padding: '4px' }} /></td>
               <td><input type="number" value={line.floor_fee} onChange={e=>{ const ni=[...form.items]; ni[idx].floor_fee=e.target.value; setForm({...form, items:ni}); }} style={{ width: '45px', padding: '4px' }} /></td>
               <td style={{ textAlign: 'left', fontWeight: 900, fontSize: '12px' }}>{line.subtotal}</td>
             </tr>
           ))}</tbody>
        </table>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
           <button onClick={handleSave} style={{ flex: 1, padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
           <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f4f4f5', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>رجوع</button>
        </div>
      </div>
    </div>
  );
}
