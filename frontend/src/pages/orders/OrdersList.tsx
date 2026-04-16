import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSalesOrders: build.query({
      query: () => 'sales-orders/',
      providesTags: ['Sales'] as any,
    }),
    getPurchaseOrders: build.query({
      query: () => 'purchase-orders/',
      providesTags: ['Shipments'] as any,
    }),
    convertSalesOrder: build.mutation({
      query: (id) => ({
        url: `sales-orders/${id}/convert-to-invoice/`,
        method: 'POST',
      }),
      invalidatesTags: ['Sales', 'Cash'] as any,
    }),
    convertPurchaseOrder: build.mutation({
      query: (id) => ({
        url: `purchase-orders/${id}/convert-to-shipment/`,
        method: 'POST',
      }),
      invalidatesTags: ['Shipments'] as any,
    }),
  }),
});

export const { useGetSalesOrdersQuery, useGetPurchaseOrdersQuery, useConvertSalesOrderMutation, useConvertPurchaseOrderMutation } = ordersApi;

export default function OrdersList() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  
  const { data: salesOrders, isLoading: loadingSales, refetch: refetchSales } = useGetSalesOrdersQuery({});
  const { data: purchaseOrders, isLoading: loadingPurchases, refetch: refetchPurchases } = useGetPurchaseOrdersQuery({});
  
  const [convertSalesOrder] = useConvertSalesOrderMutation();
  const [convertPurchaseOrder] = useConvertPurchaseOrderMutation();

  const handleAction = async (type: 'sales' | 'purchase', id: string) => {
    try {
      if (type === 'sales') {
         await convertSalesOrder(id).unwrap();
         showToast('تم تحويل أمر البيع إلى فاتورة وخصم الكميات من المخزون بنجاح!', 'success');
         refetchSales();
      } else {
         await convertPurchaseOrder(id).unwrap();
         showToast('تم تحويل أمر الشراء إلى فاتورة إرسالية بنجاح!', 'success');
         refetchPurchases();
      }
    } catch (err: any) {
      showToast(`خطأ: ${err?.data?.error || 'حدث خطأ غير معروف'}`, 'error');
    }
  };

  if (loadingSales || loadingPurchases) return <VegetableLoader text="جاري تحميل سجل الطلبيات..." />;

  const orders = activeTab === 'sales' ? (salesOrders || []) : (purchaseOrders || []);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-emerald-600">receipt_long</span>
             أوامر البيع والشراء
          </h2>
          <p className="text-zinc-500 font-bold mt-1">إنشاء ومتابعة أوامر البيع والشراء وتحويلها لفواتير فعلية.</p>
        </div>
        <div className="flex p-1 bg-zinc-100 rounded-2xl overflow-hidden">
          <button 
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'sales' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('sales')}
          >
            أوامر بيع للعملاء
          </button>
          <button 
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'purchase' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            onClick={() => setActiveTab('purchase')}
          >
            أوامر شراء للمزارعين
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100 p-6">
         <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-5">تاريخ الأمر</th>
                <th className="px-6 py-5">العميل / المزارع</th>
                <th className="px-6 py-5">الحالة</th>
                <th className="px-6 py-5 text-center">الإجراءات المحاسبية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 font-code">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-sm text-zinc-600 border-x border-zinc-50">
                     {order.customer?.name || order.supplier?.name || "غير محدد"}
                  </td>
                  <td className="px-6 py-4 border-x border-zinc-50">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                      order.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {order.status === 'pending' ? 'قيد الانتظار' :
                       order.status === 'delivered' ? 'مكتمل (تم التحويل)' : 'ملغي'}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-x border-zinc-50 flex justify-center gap-2">
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => handleAction(activeTab, order.id)} 
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                       <span className="material-symbols-outlined text-[14px]">done_all</span> 
                       {activeTab === 'sales' ? 'تحويل لفاتورة المبيعات' : 'تحويل لإرسالية الوارد'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold">لا توجد أوامر حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
