import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';

const supplierApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query({
      query: () => 'suppliers/',
      providesTags: ['Suppliers'],
    }),
    createSupplier: build.mutation({
      query: (body) => ({
        url: 'suppliers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Suppliers'],
    }),
    getCustomers: build.query({
      query: () => 'customers/',
      providesTags: ['Customers'],
    }),
  }),
});

export const { useGetSuppliersQuery, useCreateSupplierMutation, useGetCustomersQuery } = supplierApi;

const SuppliersList = () => {
  const { data: suppliersData, isLoading } = useGetSuppliersQuery({});
  const [createSupplier] = useCreateSupplierMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', deal_type: 'commission', commission_type: 'percent', commission_rate: 5
  });

  const suppliers = suppliersData?.results || (Array.isArray(suppliersData) ? suppliersData : []);

  const totalBalance = suppliers.reduce((sum: number, s: any) => sum + parseFloat(s.balance || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSupplier(formData).unwrap();
      setIsModalOpen(false);
      setFormData({name: '', phone: '', deal_type: 'commission', commission_type: 'percent', commission_rate: 5});
    } catch(err) {
      alert('خطأ في التسجيل');
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="240px" rows={7} columns={5} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-on-surface">إدارة الموردين</h2>
          <p className="text-on-surface-variant mt-2">متابعة حسابات الموردين، العمولات، والأرصدة الجارية.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform active:scale-95 font-bold text-lg h-[56px]">
          <span className="material-symbols-outlined">person_add</span>
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* Dashboard Highlights (Asymmetric Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border-e-4 border-primary-fixed flex justify-between items-center">
          <div>
            <p className="text-on-surface-variant text-sm font-bold mb-1">إجمالي أرصدة الذمة</p>
            <h3 className="text-4xl font-black text-primary">
              {Math.abs(totalBalance).toLocaleString()} <span className="text-lg font-bold">ج.م</span>
            </h3>
          </div>
          <div className="bg-primary/5 p-4 rounded-full">
            <span className="material-symbols-outlined text-4xl text-primary">payments</span>
          </div>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-on-surface-variant text-sm font-bold">عدد الموردين النشطين</p>
          <h3 className="text-3xl font-black text-on-surface">{suppliers.length}</h3>
          <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">verified</span>
            مُسجّل ومُعتمد
          </div>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-on-surface-variant text-sm font-bold">إجمالي الفوارغ</p>
          <h3 className="text-3xl font-black text-secondary">--</h3>
          <div className="mt-2 text-xs text-secondary font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">package_2</span>
            قيد التطوير
          </div>
        </div>
      </div>

      {/* Suppliers Data Table */}
      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-zinc-100">
        {/* Table Filters */}
        <div className="p-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-50/50 border-b border-zinc-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <input 
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary text-sm outline-none transition-shadow" 
                placeholder="بحث عن مورد بالاسم أو الرقم..." 
                type="text"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">search</span>
            </div>
            <button className="p-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">
              <span className="material-symbols-outlined text-zinc-600">filter_list</span>
            </button>
          </div>
          <div className="flex gap-2 bg-white border border-zinc-100 p-1 rounded-full">
            <span className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-full text-sm font-bold cursor-pointer">الكل</span>
            <span className="px-4 py-2 hover:bg-zinc-50 text-zinc-500 rounded-full text-sm font-bold cursor-pointer transition-colors">كمسيون</span>
            <span className="px-4 py-2 hover:bg-zinc-50 text-zinc-500 rounded-full text-sm font-bold cursor-pointer transition-colors">شراء</span>
          </div>
        </div>

        {/* Actual Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-none">
            <thead>
              <tr className="bg-surface-container-low/30 text-on-surface-variant border-b border-zinc-100">
                <th className="px-6 py-4 font-bold text-sm">المورد</th>
                <th className="px-6 py-4 font-bold text-sm">نوع التعامل</th>
                <th className="px-6 py-4 font-bold text-sm text-center">العمولة</th>
                <th className="px-6 py-4 font-bold text-sm">رصيد الذمة</th>
                <th className="px-6 py-4 font-bold text-sm text-center">الفوارغ</th>
                <th className="px-6 py-4 font-bold text-sm text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {suppliers.map((s: any, idx: number) => {
                const isCommission = s.deal_type === 'commission';
                const initial = s.name.charAt(0);
                const colorClasses = [
                  "bg-emerald-100 text-emerald-800",
                  "bg-orange-100 text-orange-800",
                  "bg-blue-100 text-blue-800",
                  "bg-purple-100 text-purple-800"
                ][idx % 4];

                return (
                  <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-inner ${colorClasses}`}>
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface text-sm md:text-base">{s.name}</div>
                          <div className="text-xs text-on-surface-variant font-code" dir="ltr">{s.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-3 py-1 text-[11px] font-bold rounded-md ${isCommission ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {isCommission ? 'كمسيون' : 'شراء مقطوع'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center font-bold text-primary text-sm">
                      {isCommission ? `${s.commission_rate} ${s.commission_type === 'percent' ? '%' : 'ج'}` : <span className="text-zinc-300">---</span>}
                    </td>
                    <td className="px-6 py-5">
                      <div className={`font-bold text-sm ${parseFloat(s.balance) < 0 ? 'text-error' : 'text-on-surface'}`}>
                        {parseFloat(s.balance).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="font-bold text-secondary text-sm">0</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button className="px-4 py-2 border border-primary/20 bg-white text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 mx-auto shadow-sm">
                        <span className="material-symbols-outlined text-[1rem]">description</span>
                        <span>كشف حساب</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    لا يوجد موردين مسجلين بعد. ابدأ بإضافة مورد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Dummy */}
        <div className="px-6 py-4 flex justify-between items-center bg-zinc-50/50 border-t border-zinc-100">
          <p className="text-xs text-zinc-500 font-medium">عرض جميع الموردين</p>
        </div>
      </div>

      {/* Modern Slide-out Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[200] flex items-center justify-start lg:justify-end">
          <div className="bg-white w-full lg:max-w-md h-full lg:mr-auto shadow-2xl flex flex-col animate-fade-in border-l border-zinc-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-900">
                <span className="material-symbols-outlined">person_add</span>
                إضافة مورد جديد
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto w-full">
              <form id="supplierForm" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">اسم المورد</label>
                  <input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-surface-container-high border-none rounded-xl px-4 focus:ring-2 focus:ring-primary h-[54px] transition-all" 
                    placeholder="مؤسسة فلان / المزارع فلان" 
                    type="text"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">رقم الجوال</label>
                  <input 
                    required 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-surface-container-high border-none rounded-xl px-4 focus:ring-2 focus:ring-primary h-[54px] text-right font-code transition-all" 
                    dir="ltr" 
                    placeholder="01xxxxxxxxx" 
                    type="tel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">نوع التعامل</label>
                    <div className="relative">
                      <select 
                        value={formData.deal_type} 
                        onChange={e => setFormData({...formData, deal_type: e.target.value})}
                        className="w-full bg-surface-container-high border-none rounded-xl px-4 appearance-none focus:ring-2 focus:ring-primary h-[54px] text-sm transition-all"
                      >
                        <option value="commission">كمسيون (حِسبة)</option>
                        <option value="direct_purchase">شراء مباشر</option>
                      </select>
                      <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2 text-zinc-400">العمولة</label>
                   {formData.deal_type === 'commission' ? (
                    <div className="flex focus-within:ring-2 ring-primary rounded-xl overflow-hidden bg-surface-container-high h-[54px] transition-all">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={formData.commission_rate} 
                        onChange={e => setFormData({...formData, commission_rate: parseFloat(e.target.value)})}
                        className="w-full bg-transparent border-none focus:ring-0 px-4 text-center font-bold" 
                      />
                      <select 
                        value={formData.commission_type} 
                        onChange={e => setFormData({...formData, commission_type: e.target.value})}
                        className="bg-zinc-200/50 border-none px-2 text-xs font-bold focus:ring-0"
                      >
                        <option value="percent">%</option>
                        <option value="fixed">ج</option>
                      </select>
                    </div>
                   ) : (
                     <div className="w-full bg-surface-container-low border-none rounded-xl px-4 flex items-center justify-center text-zinc-400 font-bold h-[54px]">
                       غير مطبق
                     </div>
                   )}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-zinc-100 flex gap-4 bg-zinc-50/50">
              <button 
                form="supplierForm" 
                type="submit" 
                className="flex-1 h-[56px] bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95">
                  حفظ المورد
              </button>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-8 h-[56px] bg-white border border-zinc-200 text-on-surface-variant rounded-xl font-bold hover:bg-zinc-100 transition-colors">
                  إلغاء
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SuppliersList;
