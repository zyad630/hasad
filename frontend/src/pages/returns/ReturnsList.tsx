import React, { useState } from 'react';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const returnsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSaleReturns: build.query({
      query: () => 'sale-returns/',
      providesTags: ['Sales'],
    }),
    getPurchaseReturns: build.query({
      query: () => 'purchase-returns/',
      providesTags: ['Shipments'],
    }),
  }),
});

export const { useGetSaleReturnsQuery, useGetPurchaseReturnsQuery } = returnsApi;

export default function ReturnsList() {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  
  const { data: saleReturns, isLoading: loadingSales } = useGetSaleReturnsQuery({});
  const { data: purchaseReturns, isLoading: loadingPurchases } = useGetPurchaseReturnsQuery({});

  if (loadingSales || loadingPurchases) return <VegetableLoader text="جاري تحميل سجل المرتجعات..." />;

  const returns = activeTab === 'sales' ? (saleReturns || []) : (purchaseReturns || []);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">assignment_return</span>
             سجل المرتجعات
          </h2>
          <p className="text-zinc-500 font-bold mt-1">عرض مرتجعات المبيعات والمشتريات والكميات المرجعة للمخزون.</p>
        </div>
        <div className="flex p-1 bg-zinc-100 rounded-2xl overflow-hidden">
          <button 
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'sales' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('sales')}
          >
            مرتجعات الزبائن
          </button>
          <button 
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'purchase' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('purchase')}
          >
            مرتجع للموردين (فلاح)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100 p-6">
         <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-5">تاريخ الإرجاع</th>
                <th className="px-6 py-5">رقم الحركة الأصلية</th>
                <th className="px-6 py-5">عدد الأصناف المُرجعة</th>
                <th className="px-6 py-5">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {returns.map((ret: any) => (
                <tr key={ret.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 font-code">{new Date(ret.return_date).toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 border-x border-zinc-50">
                     <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded text-xs">
                       {activeTab === 'sales' ? (ret.original_sale?.id || 'غير متوفر') : (ret.original_shipment?.id || 'غير متوفر')}
                     </span>
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600 text-lg border-x border-zinc-50">
                     {ret.items?.length || 0} صنف
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-zinc-400 border-x border-zinc-50">
                     {ret.reason || 'بدون ملاحظات'}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold">لا يوجد مرتجعات مسجلة في هذا التبويب.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
