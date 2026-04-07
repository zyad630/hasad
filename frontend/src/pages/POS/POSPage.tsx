import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

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
    getCurrencies: build.query({
      query: () => 'currencies/',
      providesTags: ['Currencies'],
    }),
  }),
});

export const { useGetOpenShipmentsQuery, useGetCustomersQuery, useCreateSaleMutation, useGetCurrenciesQuery } = posApi;

// Mock Exchange Rates (In production, these would come from an API)
const EXCHANGE_RATES: Record<string, number> = {
  ILS: 1.0,
  USD: 3.75, // 1 USD = 3.75 ILS
  JOD: 5.25, // 1 JOD = 5.25 ILS
  EGP: 0.078, // 1 EGP = 0.078 ILS
};

export default function POSPage() {
  const { showToast } = useToast();
  const { data: shipments, isLoading: loadingShipments } = useGetOpenShipmentsQuery({});
  const { data: customers } = useGetCustomersQuery({});
  const { data: currenciesData } = useGetCurrenciesQuery({});
  const [createSale, { isLoading: isCreatingSale }] = useCreateSaleMutation();

  const [items, setItems] = useState<any[]>([]);
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);
  
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [containersOut, setContainersOut] = useState<number>(0);

  const prevCurrency = useRef(currencyCode);

  useEffect(() => {
    // Dynamic Conversion when Currency Changes
    if (prevCurrency.current !== currencyCode) {
      const oldRate = EXCHANGE_RATES[prevCurrency.current] || 1;
      const newRate = EXCHANGE_RATES[currencyCode] || 1;
      const factor = oldRate / newRate;

      setItems(prev => prev.map(item => ({
        ...item,
        unit_price: Number((item.unit_price * factor).toFixed(2)),
        subtotal: Number((item.subtotal * factor).toFixed(2))
      })));
      
      prevCurrency.current = currencyCode;
    }
  }, [currencyCode]);

  const availableItems = (shipments || []).flatMap((s: any) => 
    (s.items || []).filter((i: any) => i.remaining_qty > 0).map((i: any) => ({
      ...i,
      shipmentId: s.id,
      supplierName: s.supplier_name,
      displayName: `${i.item_name} - ${s.supplier_name}`,
    }))
  );

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isModalOpen) {
        e.preventDefault();
        handleCheckout();
      }
      if (e.key === 'F3' && !isModalOpen) {
        e.preventDefault();
        setItems([]);
      }
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, payType, selectedCustomerId, isModalOpen]);

  const openAddItemModal = (item: any) => {
    setActiveItem(item);
    // Convert expected price to current POS currency
    const basePrice = item.expected_price || 20;
    const currentRate = EXCHANGE_RATES[currencyCode] || 1;
    setPrice(Number((basePrice / currentRate).toFixed(2)));
    setQuantity('');
    setContainersOut(0);
    setIsModalOpen(true);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !quantity || !price) return;
    
    const qty = Number(quantity);
    const prc = Number(price);

    setItems(prev => [...prev, {
      shipment_item_id: activeItem.id,
      name: activeItem.item_name,
      supplier: activeItem.supplierName,
      quantity: qty,
      unit_price: prc,
      subtotal: qty * prc,
      containers_out: containersOut,
    }]);

    setIsModalOpen(false);
    setActiveItem(null);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return showToast('الفاتورة فارغة', 'info');
    if (payType === 'credit' && !selectedCustomerId) return showToast('اختر التاجر للبيع الآجل', 'info');

    try {
      const payload = {
        payment_type: payType,
        customer: selectedCustomerId || null,
        currency_code: currencyCode,
        items: items.map(i => ({
          shipment_item: i.shipment_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          containers_out: i.containers_out
        }))
      };

      await createSale(payload).unwrap();
      showToast('تم اعتماد الفاتورة بنجاح ورصيدها في الخزينة الآن', 'success');
      setItems([]);
      setSelectedCustomerId('');
    } catch (err: any) {
      showToast(err.data?.detail || 'حدث خطأ في الحفظ', 'info');
    }
  };

  if (loadingShipments) return <VegetableLoader text="جاري تجهيز بوابة المبيعات السريعة..." fullScreen />;

  return (
    <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-fade-in min-h-[calc(100vh-160px)]">
      
      {/* Right: Products Grid */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-black text-slate-800">الأصناف المتوفرة</h2>
            <div className="bg-emerald-50 px-4 py-2 rounded-2xl text-emerald-700 font-bold text-sm border border-emerald-100 flex items-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
               مخزن حي: {availableItems.length} صنف
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
           {availableItems.map((item: any) => (
             <button 
               key={item.id} 
               onClick={() => openAddItemModal(item)}
               className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-right flex flex-col gap-4 group active:scale-95"
             >
                <div className="h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-300 group-hover:scale-105 transition-transform">
                   {item.item_name.substring(0,1)}
                </div>
                <div>
                   <h4 className="font-black text-slate-800 text-lg line-clamp-1">{item.item_name}</h4>
                   <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tighter">{item.supplierName}</p>
                   <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                      <span className="text-emerald-600 font-black">{item.remaining_qty} قفص</span>
                      <span className="text-xs font-bold text-slate-300">متاح</span>
                   </div>
                </div>
             </button>
           ))}
        </div>
      </div>

      {/* Left: Cart & Checkout */}
      <div className="w-full xl:w-[450px] space-y-6">
        
        {/* Settings Card */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white space-y-6 sticky top-24">
           <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
              <button onClick={() => setPayType('cash')} className={`flex-1 py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${payType === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>
                <span className="material-symbols-outlined text-xl">payments</span> كاش
              </button>
              <button onClick={() => setPayType('credit')} className={`flex-1 py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${payType === 'credit' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>
                <span className="material-symbols-outlined text-xl">person</span> ذمة / آجل
              </button>
           </div>

           {payType === 'credit' && (
             <div className="animate-fade-in">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-2">اختيار التاجر المستلم</label>
                <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-bold outline-none focus:border-orange-400 transition-all">
                   <option value="">-- ابحث عن اسم التاجر --</option>
                   {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
           )}

           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 px-2">عملة التداول الحالية</label>
              <div className="grid grid-cols-4 gap-2">
                 {['ILS', 'USD', 'JOD', 'EGP'].map(code => (
                   <button 
                     key={code} 
                     onClick={() => setCurrencyCode(code)}
                     className={`h-12 rounded-xl font-black text-xs transition-all border-2 ${currencyCode === code ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' : 'bg-white text-slate-400 border-slate-100 hovr:border-slate-200'}`}
                   >
                     {code === 'ILS' ? '₪ شيكل' : code === 'USD' ? '$ دولار' : code === 'JOD' ? 'د.أردني' : 'E£ جنيه'}
                   </button>
                 ))}
              </div>
           </div>

           {/* Items List inside Card */}
           <div className="pt-6 border-t border-slate-100 space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
              <h3 className="font-bold text-slate-800 px-2 flex items-center gap-2">
                <span className="material-symbols-outlined">receipt</span> التفاصيل ({items.length})
              </h3>
              {items.map((item, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center group relative overflow-hidden">
                   <div className="absolute top-0 right-0 h-full w-1 bg-emerald-500"></div>
                   <div>
                      <p className="font-black text-slate-800 text-sm">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{item.quantity} × {item.unit_price} {currencyCode}</p>
                   </div>
                   <div className="text-left font-black text-emerald-700">
                      {(item.subtotal).toLocaleString()}
                   </div>
                   <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                     <span className="material-symbols-outlined text-sm">delete</span>
                   </button>
                </div>
              ))}
              {items.length === 0 && <div className="text-center py-6 text-slate-300 font-bold italic">لا توجد أصناف مضافة</div>}
           </div>

           {/* Total & Checkout */}
           <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-baseline px-2">
                 <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">المبلغ المستحق</span>
                 <h2 className="text-4xl font-black text-emerald-800 tracking-tighter">
                   {total.toLocaleString()} <span className="text-lg opacity-40">{currencyCode}</span>
                 </h2>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={items.length === 0 || isCreatingSale}
                className={`w-full h-18 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 ${items.length > 0 ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-emerald-600/30' : 'bg-slate-100 text-slate-300 shadow-none'}`}
              >
                {isCreatingSale ? 'جاري الاعتماد...' : 'تأكيد وحفظ الفاتورة (F2)'}
              </button>
           </div>
        </div>
      </div>

      {/* Item Modal */}
      {isModalOpen && activeItem && createPortal(
        <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-fade-in border border-white">
              <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-3xl mx-auto flex items-center justify-center text-4xl font-black mb-4">
                   {activeItem.item_name.substring(0,1)}
                 </div>
                 <h3 className="text-2xl font-black text-slate-800">{activeItem.item_name}</h3>
                 <p className="text-slate-400 font-bold text-sm">{activeItem.supplierName}</p>
              </div>

              <form onSubmit={handleAddItem} className="space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">الكمية المطلوبة (متاح: {activeItem.remaining_qty})</label>
                    <input type="number" step="1" required autoFocus value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-14 bg-slate-100 border-none rounded-2xl px-6 font-black text-2xl text-center focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">سعر الوحدة بالـ {currencyCode}</label>
                    <input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-14 bg-emerald-50 border-none rounded-2xl px-6 font-black text-2xl text-center text-emerald-700 focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                 </div>
                 <div className="flex gap-4 mt-8">
                    <button type="submit" className="flex-1 h-16 bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 hover:scale-105 active:scale-95 transition-all">إضافة</button>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 h-16 bg-slate-50 text-slate-400 rounded-2xl font-bold">إلغاء</button>
                 </div>
              </form>
           </div>
        </div>
      , document.body)}
    </div>
  );
}
