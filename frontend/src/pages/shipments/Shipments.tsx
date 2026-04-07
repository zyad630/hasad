import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';
import { useGetSuppliersQuery } from '../suppliers/Suppliers';
import { useGetItemsQuery } from '../inventory/Inventory';

const shipmentApi = api.injectEndpoints({
  endpoints: (build) => ({
    getShipments: build.query({
      query: () => 'shipments/',
      providesTags: ['Shipments'],
    }),
    createShipment: build.mutation({
      query: (body) => ({
        url: 'shipments/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Shipments'],
    }),
  }),
});

export const { useGetShipmentsQuery, useCreateShipmentMutation } = shipmentApi;

const Shipments = () => {
  const { showToast } = useToast();
  const { data: shipmentsData, isLoading } = useGetShipmentsQuery({});
  const { data: suppliersData } = useGetSuppliersQuery({});
  const { data: itemsData } = useGetItemsQuery({});
  const [createShipment] = useCreateShipmentMutation();

  const shipments = shipmentsData?.results || (Array.isArray(shipmentsData) ? shipmentsData : []);
  const suppliers = suppliersData?.results || (Array.isArray(suppliersData) ? suppliersData : []);
  const items = itemsData?.results || (Array.isArray(itemsData) ? itemsData : []);

  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier: '', shipment_date: new Date().toISOString().split('T')[0], deal_type: 'commission', notes: ''
  });
  
  const [shipmentItems, setShipmentItems] = useState([
    { item: '', quantity: 0, unit: 'kg', expected_price: 0 }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (shipmentItems.length === 0 || shipmentItems[0].item === '') {
      showToast('يجب إضافة صنف واحد على الأقل', 'warning');
      return;
    }
    try {
      await createShipment({
        ...formData,
        items: shipmentItems
      }).unwrap();
      setIsAdding(false);
      setFormData({supplier: '', shipment_date: new Date().toISOString().split('T')[0], deal_type: 'commission', notes: ''});
      setShipmentItems([{ item: '', quantity: 0, unit: 'kg', expected_price: 0 }]);
    } catch(err) {
      showToast('خطأ في إدخال الإرسالية.', 'error');
    }
  };

  const handleAddItem = () => {
    setShipmentItems([...shipmentItems, { item: '', quantity: 0, unit: 'kg', expected_price: 0 }]);
  };

  const removeItem = (idx: number) => {
    const newItems = [...shipmentItems];
    newItems.splice(idx, 1);
    setShipmentItems(newItems.length ? newItems : [{ item: '', quantity: 0, unit: 'kg', expected_price: 0 }]);
  };

  if (isLoading) return <TableSkeleton titleWidth="240px" rows={7} columns={6} />;

  // --------------------------------------------------------------------------
  // CREATE SHIPMENT VIEW (Matches stitch _2 design entirely)
  // --------------------------------------------------------------------------
  if (isAdding) {
    return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => setIsAdding(false)} 
              className="p-2 bg-white border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors shadow-sm text-zinc-500">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <h2 className="text-3xl font-bold text-emerald-900">إضافة إرسالية جديدة</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 mt-6">
          {/* Quick Selection Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Supplier Selection (Bento Large) */}
            <section className="md:col-span-7 bg-surface-container-lowest p-8 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] border-e-4 border-primary-fixed">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person</span>
                  المزارع (البائع)
                </h3>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <span className="absolute inset-y-0 right-4 flex items-center text-zinc-400">
                    <span className="material-symbols-outlined">search</span>
                  </span>
                  <select 
                    required 
                    value={formData.supplier} 
                    onChange={e => {
                      setFormData({...formData, supplier: e.target.value});
                      const slr = suppliers?.find((s:any) => s.id.toString() === e.target.value.toString());
                      if (slr) setFormData(prev => ({...prev, deal_type: slr.deal_type || 'commission'}));
                    }}
                    className="w-full h-14 pe-12 ps-4 appearance-none bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary text-lg transition-all text-on-surface"
                  >
                    <option value="" disabled>ابحث واختر المزارع...</option>
                    {suppliers?.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
                    <span className="material-symbols-outlined">expand_more</span>
                  </span>
                </div>
                
                {/* Date Selection right inside supplier block for convenience */}
                <div className="pt-2">
                   <label className="text-xs font-bold text-zinc-500 mb-1 block">تاريخ الوصول</label>
                   <input 
                     type="date" 
                     className="w-full h-12 px-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary text-sm font-bold" 
                     required 
                     value={formData.shipment_date} 
                     onChange={e => setFormData({...formData, shipment_date: e.target.value})} 
                   />
                </div>
              </div>
            </section>

            {/* Transaction Type (Bento Small) */}
            <section className="md:col-span-5 bg-surface-container-lowest p-8 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] flex flex-col justify-center">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">handshake</span>
                نوع العملية
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer group">
                  <input 
                    type="radio" 
                    name="deal_type" 
                    value="commission" 
                    checked={formData.deal_type === 'commission'}
                    onChange={() => setFormData({...formData, deal_type: 'commission'})}
                    className="hidden peer" />
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 peer-checked:border-primary peer-checked:bg-primary-fixed/20 transition-all h-full">
                    <span className={`material-symbols-outlined text-3xl mb-1 ${formData.deal_type === 'commission' ? 'text-primary' : 'text-zinc-400 group-hover:text-primary'}`}>percent</span>
                    <span className="font-bold text-sm">كمسيون</span>
                  </div>
                </label>
                <label className="cursor-pointer group">
                  <input 
                    type="radio" 
                    name="deal_type" 
                    value="direct_purchase"
                    checked={formData.deal_type === 'direct_purchase'}
                    onChange={() => setFormData({...formData, deal_type: 'direct_purchase'})}
                    className="hidden peer" />
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 peer-checked:border-secondary peer-checked:bg-secondary-fixed/50 transition-all h-full">
                    <span className={`material-symbols-outlined text-3xl mb-1 ${formData.deal_type === 'direct_purchase' ? 'text-secondary' : 'text-zinc-400 group-hover:text-secondary'}`}>payments</span>
                    <span className="font-bold text-sm">شراء مباشر</span>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* Product Details Grid */}
          <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] overflow-hidden relative border border-zinc-50">
            <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-l from-primary to-secondary"></div>
            
            <div className="flex justify-between items-center mb-8 mt-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">shopping_basket</span>
                أصناف الإرسالية
              </h3>
            </div>

            <div className="space-y-6">
              {shipmentItems.map((si, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-surface-container-high/40 border border-zinc-100 relative group">
                  <button 
                     type="button"
                     onClick={() => removeItem(index)}
                     className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 shadow-sm text-error rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:scale-110 transition-all z-10"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">close</span>
                  </button>
                  
                  {/* Product Selection */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-zinc-500 tracking-wider">الصنف</label>
                    <div className="relative">
                      <select 
                        required 
                        value={si.item} 
                        onChange={e => {
                          const newArr = [...shipmentItems];
                          newArr[index].item = e.target.value;
                          setShipmentItems(newArr);
                        }}
                        className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary text-base appearance-none shadow-sm transition-all text-on-surface">
                        <option value="" disabled>- حدد الصنف -</option>
                        {items?.map((i:any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
                        <span className="material-symbols-outlined">expand_more</span>
                      </span>
                    </div>
                  </div>
                  
                  {/* Quantity */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-zinc-500 tracking-wider">الكمية</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" step="0.01" required 
                        value={si.quantity || ''}
                        onChange={e => {
                          const newArr = [...shipmentItems];
                          newArr[index].quantity = parseFloat(e.target.value) || 0;
                          setShipmentItems(newArr);
                        }}
                        className="flex-1 h-12 px-4 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary text-xl font-bold text-center shadow-sm transition-all" 
                        placeholder="0" 
                      />
                      <input 
                        className="w-24 h-12 bg-zinc-200/50 border border-zinc-200 rounded-xl focus:ring-primary text-sm font-bold text-center px-1" 
                        value={si.unit}
                        onChange={e => {
                          const newArr = [...shipmentItems];
                          newArr[index].unit = e.target.value;
                          setShipmentItems(newArr);
                        }} 
                      />
                    </div>
                  </div>

                  {/* Price (Visible if Direct Purchase or Expected) */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-500 tracking-wider">سعر متوقع/شراء <span className="text-[9px] font-normal">(اختياري)</span></label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-secondary text-xl font-bold text-center shadow-sm transition-all" 
                        placeholder="0" 
                        value={si.expected_price || ''}
                        onChange={e => {
                          const newArr = [...shipmentItems];
                          newArr[index].expected_price = parseFloat(e.target.value) || 0;
                          setShipmentItems(newArr);
                        }}
                      />
                      <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400 text-xs font-bold">ج.م</span>
                    </div>
                  </div>
                  
                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={handleAddItem} 
              className="mt-6 w-full py-4 border-2 border-dashed border-primary/30 text-primary rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined">add_circle</span>
              إضافة صنف آخر للإرسالية
            </button>
            
            {/* Notes Section */}
            <div className="mt-8 space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">ملاحظات و بيان السيارة / الفوارغ</label>
              <textarea 
                className="w-full p-4 bg-surface-container-low border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary text-base font-cairo shadow-inner" 
                placeholder="أدخل تفاصيل السيارة، أرقام اللوحات، حالة الفوارغ وصناديق التعبئة..." 
                rows={2}
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>
          </section>

          {/* Financial Summary & Submit Bar (Glassmorphism inspired) */}
          <div className="bg-emerald-900 backdrop-blur-md p-6 rounded-3xl border border-emerald-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_16px_40px_rgba(0,69,13,0.2)]">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-emerald-300 text-xs font-bold mb-1">إجمالي الأصناف المسجلة</span>
                <span className="text-3xl font-black text-white">{shipmentItems.length} <small className="text-sm font-normal opacity-80">صنف</small></span>
              </div>
            </div>
            
             <div className="flex gap-4 w-full md:w-auto">
              <button 
                type="button"
                onClick={() => setIsAdding(false)} 
                className="flex-1 md:flex-none px-8 py-5 bg-white/10 text-white border border-white/20 rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-95"
              >
                تراجع
              </button>
              <button 
                type="submit" 
                className="flex-1 md:flex-none px-10 py-5 bg-gradient-to-br from-[#86d881] to-[#acf4a4] text-[#002204] rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:opacity-90 hover:scale-[1.02] transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">check_circle</span>
                اعتماد وتحويل للمخزون
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // LIST VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-on-surface">إدارة الإرساليات (الوارد)</h2>
          <p className="text-on-surface-variant mt-2">استقبال وتتبع شحنات ومحاصيل المزارعين، وتحويلها للبيع.</p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform active:scale-95 font-bold text-lg h-[56px]" 
          onClick={() => setIsAdding(true)}
        >
          <span className="material-symbols-outlined text-[1.2rem]">local_shipping</span>
          <span>استلام بضاعة جديدة</span>
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-zinc-100">
        <div className="p-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-50/50 border-b border-zinc-100">
           <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative w-full md:w-80">
               <input 
                 className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary text-sm outline-none transition-shadow" 
                 placeholder="بحث برقم الإرسالية أو اسم المزارع..." 
                 type="text"
               />
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">search</span>
             </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-none">
            <thead>
              <tr className="bg-surface-container-low/30 text-on-surface-variant border-b border-zinc-100">
                <th className="px-6 py-4 font-bold text-sm">البوليصة</th>
                <th className="px-6 py-4 font-bold text-sm">التاريخ</th>
                <th className="px-6 py-4 font-bold text-sm">المزارع</th>
                <th className="px-6 py-4 font-bold text-sm text-center">نوع التعامل</th>
                <th className="px-6 py-4 font-bold text-sm text-center">عدد الأصناف</th>
                <th className="px-6 py-4 font-bold text-sm text-center">الوضع الحالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {shipments.map((s: any) => (
                <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors group">
                  <td className="px-6 py-5">
                    <span className="font-code font-bold text-emerald-900 bg-emerald-50 px-2 py-1 rounded-md">#{s.id.substring(0,6)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-code text-zinc-600 text-sm" dir="ltr">{s.shipment_date}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-zinc-500">
                         <span className="material-symbols-outlined text-sm">person</span>
                       </div>
                       <span className="font-bold text-on-surface">{s.supplier_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex px-3 py-1 text-[11px] font-bold rounded-md ${s.deal_type === 'commission' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                      {s.deal_type === 'commission' ? 'حِسبة' : 'شراء مقطوع'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="w-8 h-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                      {s.items?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                        s.status === 'open' 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      <span className="material-symbols-outlined text-[12px] me-1 ms-1">{s.status === 'open' ? 'storefront' : 'check_circle'}</span>
                      {s.status === 'open' ? 'قيد البيع' : 'مصـفّاة'}
                    </span>
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-zinc-300">inventory_2</span>
                      <span>لا توجد إرساليات قيد التشغيل حالياً</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Shipments;
