import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { useGetShipmentsQuery } from '../shipments/Shipments';
import { TableSkeleton } from '../../components/Skeleton';
import { useGetCurrenciesQuery } from '../settings/Currencies';

const settlementApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSettlements: build.query({
      query: () => 'settlements/',
      providesTags: ['Settlements'],
    }),
    calculateSettlement: build.mutation({
      query: (body) => ({
        url: 'settlements/calculate/',
        method: 'POST',
        body,
      }),
    }),
    confirmSettlement: build.mutation({
      query: (body) => ({
        url: 'settlements/confirm/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Settlements', 'Shipments', 'Suppliers'],
    }),
  }),
});

export const { useGetSettlementsQuery, useCalculateSettlementMutation, useConfirmSettlementMutation } = settlementApi;

export default function SettlementPage() {
  const { showToast } = useToast();
  const { data: shipmentsData, isLoading: loadingShipments } = useGetShipmentsQuery({});
  const { data: settlementsData, isLoading: loadingSettlements } = useGetSettlementsQuery({});
  const { data: currencies } = useGetCurrenciesQuery({});
  const [calculate, { isLoading: isCalculating }] = useCalculateSettlementMutation();
  const [confirm, { isLoading: isConfirming }] = useConfirmSettlementMutation();

  const [selectedShipment, setSelectedShipment] = useState('');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [previewData, setPreviewData] = useState<any>(null);

  const shipments = shipmentsData?.results || (Array.isArray(shipmentsData) ? shipmentsData : []);
  const settlements = settlementsData?.results || (Array.isArray(settlementsData) ? settlementsData : []);
  
  const openShipments = shipments.filter((s: any) => s.status === 'open') || [];

  const handleCalculate = async (shipmentId: string) => {
    setSelectedShipment(shipmentId);
    try {
      const res = await calculate({ shipment_id: shipmentId }).unwrap();
      setPreviewData(res);
    } catch (err: any) {
      showToast(err.data?.error || 'حدث خطأ في طلب حساب التصفية', 'info');
    }
  };

  const handleConfirm = async () => {
    if (!previewData?.shipment_id || !window.confirm('هل أنت متأكد من تأكيد التصفية؟ لا يمكن التراجع سيتم ترحيل الرصيد للذمم.')) return;
    try {
      await confirm({ 
        shipment_id: previewData.shipment_id,
        currency_code: currencyCode
      }).unwrap();
      showToast('تم تأكيد التصفية وإغلاق الإرسالية بنجاح ✅', 'success');
      setPreviewData(null);
      setSelectedShipment('');
    } catch (err: any) {
      showToast(err.data?.error || 'حدث خطأ أثناء التأكيد', 'info');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loadingShipments || loadingSettlements) return <TableSkeleton titleWidth="280px" rows={6} columns={5} />;

  return (
    <>
      <div className="space-y-8 animate-fade-in pb-20 no-print">
        {/* Header Section: Supplier/Shipment Selection */}
        <section className="mb-8">
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] border border-primary/10 border-e-4 border-e-primary flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1">
              <label className="block text-sm font-bold text-on-surface-variant mb-2 uppercase tracking-wide">اختر الإرسالية المفتوحة لعمل التصفية</label>
              <div className="relative group">
                <select 
                  className="w-full h-14 bg-surface-container-high border-none rounded-xl px-4 text-lg font-bold focus:ring-2 focus:ring-primary appearance-none transition-all"
                  value={selectedShipment}
                  onChange={(e) => handleCalculate(e.target.value)}
                >
                  <option value="" disabled>-- إرساليات قيد التشغيل (مفتوحة) --</option>
                  {openShipments.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      #{s.id.substring(0,8)} | المزارع: {s.supplier_name} - بتاريخ {s.shipment_date}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-4 top-4 pointer-events-none text-slate-400">expand_more</span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-primary-container/10 px-6 py-3 rounded-xl border border-primary-container/20">
                <span className="block text-xs font-bold text-primary mb-1">إرساليات غير مصفاة</span>
                <span className="text-2xl font-black text-primary">{openShipments.length}</span>
              </div>
              <div className="bg-secondary-container/10 px-6 py-3 rounded-xl border border-secondary-container/20">
                 <span className="block text-xs font-bold text-secondary mb-1">صافي اليوم (تقريبي)</span>
                 <span className="text-xl font-bold text-on-secondary-container">--- <span className="text-sm">ج.م</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid layout for Financials */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Information Table */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(26,28,28,0.04)] border border-zinc-100">
              <div className="px-6 py-5 flex justify-between items-center bg-white border-b border-surface-container-high">
               <h3 className="font-bold text-lg text-emerald-900">سجل التصفيات المُعتمدة السابقة</h3>
               <div className="flex gap-2">
                 <button className="p-2 hover:bg-slate-50 rounded-lg border border-slate-100 text-slate-500 transition-colors">
                   <span className="material-symbols-outlined text-[1.2rem]">filter_list</span>
                 </button>
               </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-on-surface-variant font-cairo border-b border-zinc-200">
                      <th className="px-6 py-4 font-bold text-sm">التاريخ</th>
                      <th className="px-6 py-4 font-bold text-sm">المزارع</th>
                      <th className="px-6 py-4 font-bold text-sm">إجمالي المبيعات</th>
                      <th className="px-6 py-4 font-bold text-sm text-secondary">الصافي للمزارع</th>
                      <th className="px-6 py-4 font-bold text-sm text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high/50">
                    {settlements.map((s: any) => (
                      <tr key={s.id} className="hover:bg-emerald-50/20 transition-colors group">
                        <td className="px-6 py-5 font-code text-sm text-zinc-500" dir="ltr">{new Date(s.settled_at).toLocaleDateString('ar-EG')}</td>
                        <td className="px-6 py-5 font-bold text-emerald-900">{s.supplier_name}</td>
                        <td className="px-6 py-5 font-bold">{parseFloat(s.total_sales).toLocaleString()} <span className="text-xs font-bold">{s.currency_code === 'ILS' ? '₪' : s.currency_code}</span></td>
                        <td className="px-6 py-5 font-black text-secondary">{parseFloat(s.net_supplier).toLocaleString()} <span className="text-xs font-bold">{s.currency_code === 'ILS' ? '₪' : s.currency_code}</span></td>
                        <td className="px-6 py-5 text-center">
                           <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${s.is_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                              {s.is_paid ? 'تم الدفع نقداً' : 'مرحّل للذمة'}
                           </span>
                        </td>
                      </tr>
                    ))}
                    {settlements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">لا يوجد سجل تصفيات سابقة مُعتمدة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Visual spacer to hold ground if calculator is empty */}
            {!previewData && (
              <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 p-12 rounded-3xl flex flex-col items-center justify-center opacity-75">
                 <span className="material-symbols-outlined text-zinc-300 text-6xl mb-4">point_of_sale</span>
                 <p className="text-zinc-500 font-bold">الرجاء تحديد إرسالية لبدء احتساب التصفية وإصدار كشف الحساب</p>
              </div>
            )}
            
          </div>

          {/* Right Column: Settlement Engine (Calculator Card) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,69,13,0.08)] border border-emerald-900/10 sticky top-24">
              <h3 className="text-xl font-black text-primary mb-8 border-e-4 border-primary pe-4">محرك التصفية الآلي (Preview)</h3>
              
              {isCalculating ? (
                 <div className="flex flex-col items-center justify-center p-8 space-y-4 text-emerald-900">
                    <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
                    <span className="font-bold animate-pulse">جاري سحب المبيعات واحتساب التسويات...</span>
                 </div>
              ) : previewData ? (
                <>
                  {/* Currency Selection */}
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wide">عملة التصفية للمزارع</label>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setCurrencyCode('ILS')}
                         className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${currencyCode === 'ILS' ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100'}`}
                       >شيكل</button>
                       {currencies?.map((cur: any) => (
                          <button 
                            key={cur.id}
                            onClick={() => setCurrencyCode(cur.code)}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${currencyCode === cur.code ? 'bg-indigo-600 text-white shadow-md' : 'bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100'}`}
                          >{cur.name.split(' ')[0]}</button>
                       ))}
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-6 mb-8">
                    <div className="flex justify-between items-center group bg-primary-fixed/20 p-4 rounded-xl">
                      <span className="text-primary font-bold">إجمالي مبيعات البضاعة</span>
                      <span className="text-2xl font-black text-primary">{parseFloat(previewData.total_sales).toLocaleString()} <span className="text-sm font-bold">{currencyCode === 'ILS' ? '₪' : currencyCode}</span></span>
                    </div>

                    <div className="p-5 bg-surface-container-low rounded-2xl space-y-5 border border-zinc-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                             <span className="material-symbols-outlined text-sm">percent</span>
                           </div>
                           <div>
                             <span className="text-sm font-bold block">عمولة الكومسيون المستقطعة</span>
                             <span className="text-xs text-zinc-500">{previewData.commission_type === 'percent' ? `بنسبة ${previewData.commission_rate}%` : `مبلغ ثابت`}</span>
                           </div>
                        </div>
                        <span className="text-error font-bold">- {parseFloat(previewData.commission_amount).toLocaleString()} ج</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                             <span className="material-symbols-outlined text-sm">local_shipping</span>
                           </div>
                           <div>
                             <span className="text-sm font-bold block">إجمالي تنزيلات ومصاريف أخرى</span>
                             <span className="text-xs text-zinc-500">نولون/مشال - إن وُجد</span>
                           </div>
                        </div>
                        <span className="text-error font-bold">- {parseFloat(previewData.total_expenses).toLocaleString()} ج</span>
                      </div>
                    </div>

                    <div className="pt-6 border-t-[3px] border-dashed border-zinc-200">
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">الصافي النهائي المستحق للمزارع</span>
                          <span className="text-4xl font-black text-emerald-600 tracking-tight">{parseFloat(previewData.net_supplier).toLocaleString()}</span>
                          <span className="text-base font-bold text-emerald-600 me-2">{currencyCode === 'ILS' ? '₪' : currencyCode}</span>
                        </div>
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                           <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: "'FILL' 1"}}>account_balance_wallet</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-4">
                    <button 
                      onClick={handleConfirm}
                      disabled={isConfirming}
                      className="w-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white h-16 rounded-2xl font-black text-lg shadow-xl shadow-emerald-700/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">verified</span>
                      {isConfirming ? 'جاري الاعتماد...' : 'اعتماد التصفية وترحيل الرصيد'}
                    </button>
                    
                    <button 
                      onClick={handlePrint}
                      className="w-full h-14 rounded-2xl border-2 border-zinc-200 text-zinc-600 font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 hover:text-emerald-900 transition-colors"
                    >
                      <span className="material-symbols-outlined">print</span>
                      معاينة كشف الحساب والطباعة
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 opacity-40 grayscale">
                    <span className="material-symbols-outlined text-6xl mb-4">calculate</span>
                    <p className="font-bold">حاسبة التصفية غير نشطة</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Styled Print Layout matching modern SaaS receipts */}
      {previewData && (
        <div className="print-only fixed inset-0 bg-white z-[999] p-8 w-full max-w-4xl mx-auto" dir="rtl" style={{fontFamily: 'Cairo, sans-serif'}}>
          <div className="flex items-center justify-between border-b-4 border-emerald-900 pb-6 mb-8">
            <div>
               <h1 className="text-4xl font-black text-emerald-900">كشف حساب وتصفية بضاعة</h1>
               <p className="text-zinc-500 font-bold mt-2 text-lg">نظام حَصاد الإلكتروني المتكامل</p>
            </div>
            <div className="text-left font-code text-zinc-500">
               <div>رقم الإرسالية: <strong className="text-black text-xl">#{previewData.shipment_id.substring(0,8)}</strong></div>
               <div>تاريخ التصفية: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
               <div>الوقت: <strong>{new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</strong></div>
            </div>
          </div>
          
          <div className="bg-zinc-50 p-6 rounded-2xl mb-8 flex justify-between border border-zinc-200">
            <div>
               <p className="text-sm text-zinc-500 font-bold mb-1">السـادة / المزارعين:</p>
               <h2 className="text-3xl font-black text-emerald-900">{previewData.supplier_name}</h2>
            </div>
            <div className="text-left">
               <p className="text-sm text-zinc-500 font-bold mb-1">إجمالي المبيعات الإجمالي:</p>
               <h2 className="text-3xl font-bold font-code">{parseFloat(previewData.total_sales).toFixed(2)} {currencyCode === 'ILS' ? '₪' : currencyCode}</h2>
            </div>
          </div>
          
          <table className="w-full text-right border-collapse mb-10 border border-zinc-300 rounded-xl overflow-hidden text-lg">
            <thead>
              <tr className="bg-emerald-900 text-white">
                <th className="px-6 py-4 border border-zinc-300 font-bold text-center">البيان</th>
                <th className="px-6 py-4 border border-zinc-300 font-bold text-center">المبلغ المستقطع ({currencyCode === 'ILS' ? 'شيكل' : currencyCode})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-4 border border-zinc-300 font-bold">العمولة المستقطعة (- {previewData.commission_type === 'percent' ? `${previewData.commission_rate}%` : ''})</td>
                <td className="px-6 py-4 border border-zinc-300 text-center font-code text-red-600 font-bold">- {parseFloat(previewData.commission_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-4 border border-zinc-300 font-bold">إجمالي المصروفات على الإرسالية (نولون وغيره)</td>
                <td className="px-6 py-4 border border-zinc-300 text-center font-code text-red-600 font-bold">- {parseFloat(previewData.total_expenses).toFixed(2)}</td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="px-6 py-6 border border-zinc-300 font-black text-xl text-emerald-900 text-center">✨ الصافي المستحق للمزارع ✨</td>
                <td className="px-6 py-6 border border-zinc-300 font-black text-2xl text-center text-emerald-900 bg-emerald-100 font-code">{parseFloat(previewData.net_supplier).toFixed(2)} {currencyCode === 'ILS' ? '₪' : currencyCode}</td>
              </tr>
            </tbody>
          </table>
          
          <div className="grid grid-cols-2 gap-20 text-center mt-20 pt-10 px-10 text-xl font-bold">
            <div className="border-t-2 border-zinc-300 pt-4 text-emerald-900">إدارة حَصاد (المالية)</div>
            <div className="border-t-2 border-zinc-300 pt-4 text-emerald-900">توقيع المسـتـلـم</div>
          </div>
          
          <div className="text-center text-zinc-400 mt-16 text-sm font-bold border-t border-zinc-100 pt-4">
             تم إصدار هذا الكشف آلياً ولا يُعتد به إلا بوجود التواقيع والأختام الرسمية - Hassad SaaS
          </div>
        </div>
      )}
    </>
  );
}
