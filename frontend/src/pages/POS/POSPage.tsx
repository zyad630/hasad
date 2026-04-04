import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

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

export const { useGetOpenShipmentsQuery, useGetCustomersQuery, useCreateSaleMutation } = posApi;

export default function POSPage() {
  const { data: shipments, isLoading: loadingShipments } = useGetOpenShipmentsQuery({});
  const { data: customers } = useGetCustomersQuery({});
  const [createSale, { isLoading: isCreatingSale }] = useCreateSaleMutation();

  const [items, setItems] = useState<any[]>([]);
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Modal for adding item properties (since price varies in wholesale)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);
  
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [containersOut, setContainersOut] = useState<number>(0);

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
      // Don't trigger F2 checkout if modal is open
      if (e.key === 'F2' && !isModalOpen) {
        e.preventDefault();
        handleCheckout();
      }
      if (e.key === 'F3' && !isModalOpen) {
        e.preventDefault();
        setItems([]);
        setPayType('cash');
        setSelectedCustomerId('');
      }
      if (e.key === 'Escape' && isModalOpen) {
        e.preventDefault();
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, payType, selectedCustomerId, isModalOpen]);

  const openAddItemModal = (item: any) => {
    setActiveItem(item);
    setPrice(item.expected_price || '');
    setQuantity('');
    setContainersOut(0);
    setIsModalOpen(true);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !quantity || !price) return;
    
    const qty = Number(quantity);
    const prc = Number(price);

    if (qty > activeItem.remaining_qty) {
      alert('الكمية المطلوبة أكبر من الرصيد المتبقي في الإرسالية');
      return;
    }

    setItems(prev => [...prev, {
      shipment_item: activeItem.id,
      shipment_item_id: activeItem.id,
      name: activeItem.item_name,
      supplier: activeItem.supplierName,
      quantity: qty,
      unit_price: prc,
      subtotal: qty * prc,
      containers_out: containersOut,
      remaining: activeItem.remaining_qty,
    }]);

    setIsModalOpen(false);
    setActiveItem(null);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      alert('الفاتورة فارغة');
      return;
    }
    if (payType === 'credit' && !selectedCustomerId) {
      alert('يجب اختيار العميل في حالة البيع الآجل (الذمم)');
      return;
    }

    try {
      const payload = {
        payment_type: payType,
        customer: selectedCustomerId || null,
        items: items.map(i => ({
          shipment_item: i.shipment_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          containers_out: i.containers_out
        }))
      };

      const res = await createSale(payload).unwrap();
      
      // Auto-print logic or receipt format could go here
      alert(`تم الدفع الاعتماد بنجاح! رقم الفاتورة: #${res.id.substring(0,8)}`);
      
      setItems([]);
      setPayType('cash');
      setSelectedCustomerId('');
      
    } catch (err: any) {
      alert(err.data?.detail || 'حدث خطأ أثناء حفظ الفاتورة');
    }
  };

  if (loadingShipments) return <TableSkeleton titleWidth="220px" rows={8} columns={4} />;

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-20 animate-fade-in relative min-h-[calc(100vh-120px)]">
      
      {/* Right Section: Items Selection Grid */}
      <div className="flex-1 space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-3xl font-black text-on-surface">قائمة الأصناف (البيع السريع)</h2>
            <p className="text-zinc-500 font-bold mt-1">اختر السلعة المتوفرة لإضافتها للفاتورة الحالية</p>
          </div>
          <div className="flex gap-2">
            <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-bold shadow-md shadow-primary/20">الجميع</button>
          </div>
        </header>

        {/* Bento Grid of Available Items */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
          {availableItems.length === 0 ? (
            <div className="col-span-full py-20 text-center text-zinc-400">
               <span className="material-symbols-outlined text-6xl mb-4 opacity-50">inventory_2</span>
               <p className="text-xl font-bold">لا توجد إرساليات بضاعة مشغلة حالياً</p>
            </div>
          ) : (
            availableItems.map((item: any) => {
              // Creating a distinct pattern/color per item for standard look
              const initials = item.item_name.substring(0,2);
              const isLowStock = item.remaining_qty < 10;
              
              return (
                <button 
                  key={item.id}
                  onClick={() => openAddItemModal(item)}
                  className="group relative overflow-hidden bg-surface-container-lowest p-5 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-zinc-100 hover:shadow-xl hover:border-emerald-200 transition-all duration-300 text-right flex flex-col gap-3 active:scale-[0.98]"
                >
                  <div className={`h-28 w-full rounded-2xl flex items-center justify-center shadow-inner overflow-hidden transition-transform group-hover:scale-[1.03] ${isLowStock ? 'bg-orange-50 text-orange-200' : 'bg-emerald-50 text-emerald-200'}`}>
                    <span className="text-5xl font-black opacity-30 select-none">{initials}</span>
                    <span className="material-symbols-outlined absolute text-[80px] opacity-10">nutrition</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{item.item_name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-medium">مورد: {item.supplierName}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100">
                      <span className="text-primary font-black text-sm">{item.expected_price || '-'} <span className="text-xs font-normal">ج</span></span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${isLowStock ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                        متبقي: {item.remaining_qty}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Left Section: Cart & POS Panel */}
      <div className="w-full lg:w-[480px] flex flex-col gap-5 h-auto lg:sticky lg:top-24 lg:max-h-[calc(100vh-150px)]">
        
        {/* Customer & Type Selector */}
        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-zinc-100 space-y-5">
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-zinc-100 rounded-2xl">
            <button 
              onClick={() => { setPayType('cash'); setSelectedCustomerId(''); }}
              className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${payType === 'cash' ? 'bg-white shadow-sm text-emerald-700 border-2 border-emerald-500/20' : 'text-zinc-500 border-2 border-transparent'}`}
            >
              <span className="material-symbols-outlined font-bold">payments</span> بيع نقدي
            </button>
            <button 
              onClick={() => setPayType('credit')}
              className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${payType === 'credit' ? 'bg-white shadow-sm text-secondary border-2 border-orange-500/20' : 'text-zinc-500 border-2 border-transparent'}`}
            >
              <span className="material-symbols-outlined font-bold">credit_score</span> بيع آجل (ذمم)
            </button>
          </div>

          <div className="bg-zinc-50/80 p-4 rounded-2xl border border-zinc-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${payType === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
              <span className="material-symbols-outlined">{payType === 'cash' ? 'storefront' : 'person'}</span>
            </div>
            <div className="flex-1">
              {payType === 'cash' ? (
                <>
                  <p className="font-bold text-base text-slate-800">عميل نقدي عام</p>
                  <p className="text-xs text-emerald-600 font-bold">يدفع الفاتورة فوراً بالكاش</p>
                </>
              ) : (
                <div className="relative">
                  <select 
                    className="w-full bg-transparent border-b-2 border-zinc-300 focus:border-secondary py-1 ps-6 pe-0 appearance-none font-bold text-base transition-colors"
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="" disabled>-- اختر العميل من السجل --</option>
                    {customers?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute left-0 bottom-1 pointer-events-none text-zinc-400">expand_more</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart Details */}
        <div className="flex-1 bg-white p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-zinc-100 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-emerald-950 flex items-center gap-2">
               <span className="material-symbols-outlined my-auto">receipt_long</span> 
               الفاتورة الحالية
            </h3>
            <span className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-black border border-emerald-100">{items.length} أصناف</span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto space-y-3 pe-2 no-scrollbar min-h-[150px]">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between items-center group p-3 hover:bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-100 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 bg-white border shadow-sm border-zinc-100 rounded-xl flex items-center justify-center text-primary font-black text-lg">
                    {item.name.substring(0,1)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1.5 font-bold">
                      <span className="text-emerald-700 font-black">{item.quantity} × {item.unit_price} ج</span>
                      {item.containers_out > 0 && <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-md border border-orange-100">فوارغ: {item.containers_out}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-left flex flex-col items-end">
                  <p className="font-black text-emerald-900 text-lg">{item.subtotal.toLocaleString()} <span>ج</span></p>
                  <button 
                    onClick={() => removeItem(index)}
                    className="text-red-400 hover:text-red-600 mt-1 md:opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-3">
                <span className="material-symbols-outlined text-6xl">shopping_cart</span>
                <p className="font-bold">سلة المبيعات فارغة</p>
              </div>
            )}
          </div>

          {/* Totals & Checkout */}
          <div className="border-t-[3px] border-dashed border-zinc-200 pt-6 mt-4 space-y-4">
            <div className="flex justify-between items-end bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
              <div>
                <span className="text-zinc-500 font-bold block mb-1">الإجمالي المطلوب الدفع</span>
                <div className="flex gap-2 text-xs font-bold text-zinc-400">
                  <span className="border border-zinc-200 px-1.5 rounded bg-white">F2 التنفيذ</span>
                  <span className="border border-zinc-200 px-1.5 rounded bg-white">F3 تصفير</span>
                </div>
              </div>
              <span className="text-4xl font-black text-emerald-700 tracking-tight">{total.toLocaleString()} <span className="text-xl">ج.م</span></span>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={isCreatingSale || items.length === 0}
              className={`w-full py-5 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 shadow-xl transition-all ${items.length > 0 ? (payType === 'cash' ? 'bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.98]' : 'bg-gradient-to-tr from-secondary to-orange-400 text-white shadow-orange-600/30 active:scale-[0.98]') : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'}`}
            >
              <span className="material-symbols-outlined text-3xl">{payType === 'cash' ? 'point_of_sale' : 'draw'}</span>
              {isCreatingSale ? 'جاري الإصدار...' : (payType === 'cash' ? 'إتمام البيع الكاش' : 'دفع آجل وتسجيل بالذمة')}
            </button>
          </div>
        </div>
      </div>

      {/* Adding Modal for an Item */}
      {isModalOpen && activeItem && createPortal(
        <div className="fixed inset-0 z-[200] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[400px] rounded-[2rem] shadow-2xl animate-fade-in overflow-hidden border border-zinc-100">
             <div className="bg-emerald-50 px-6 py-5 border-b border-emerald-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-emerald-900 flex gap-2 items-center">
                   <span className="material-symbols-outlined text-emerald-600">add_shopping_cart</span>
                   تسعير وضبط الصنف
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-zinc-500 hover:text-red-500 transition-colors shadow-sm">
                   <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
             </div>

             <div className="p-6">
                <div className="mb-6 pb-6 border-b border-zinc-100 text-center">
                   <h4 className="text-2xl font-black text-slate-800">{activeItem.item_name}</h4>
                   <p className="text-zinc-500 font-bold text-sm mt-1 mb-2">إرسالية المورد: {activeItem.supplierName}</p>
                   <span className="inline-block bg-primary-fixed/20 text-primary-fixed-variant px-3 py-1 rounded-md text-xs font-black">
                     الرصيد المتاح: {activeItem.remaining_qty}
                   </span>
                </div>

                <form onSubmit={handleAddItem} className="space-y-5">
                   <div>
                     <label className="block text-sm font-bold text-zinc-500 mb-2">الكمية المطلوبة للبيع</label>
                     <div className="relative">
                       <input 
                         type="number" step="0.5" 
                         required autoFocus
                         className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl h-14 px-5 text-xl font-black text-center focus:border-emerald-500 focus:ring-0 focus:bg-white transition-colors" 
                         value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} max={activeItem.remaining_qty}
                       />
                     </div>
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-zinc-500 mb-2">تسعير الوحدة الحالي (ج.م)</label>
                     <div className="relative">
                       <input 
                         type="number" step="0.5" 
                         required
                         className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl h-14 px-5 text-xl font-black text-center text-primary focus:border-emerald-500 focus:ring-0 focus:bg-white transition-colors" 
                         value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} 
                       />
                     </div>
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-zinc-500 mb-2">عدد الفوارغ التي سيأخذها المشتري (إن وجد)</label>
                     <div className="relative">
                       <input 
                         type="number"
                         className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl h-12 px-5 text-lg font-bold text-center focus:border-orange-500 focus:ring-0 focus:bg-white transition-colors" 
                         value={containersOut || ''} onChange={e => setContainersOut(parseInt(e.target.value) || 0)} placeholder="0"
                       />
                       <span className="material-symbols-outlined absolute left-4 top-3 text-zinc-300">inventory_2</span>
                     </div>
                   </div>

                   <button type="submit" className="w-full mt-4 bg-emerald-600 text-white h-14 rounded-2xl font-black text-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-transform">
                      إضافة للفاتورة
                   </button>
                </form>
             </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
