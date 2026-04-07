import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

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
    updateSupplier: build.mutation({
      query: ({ id, ...body }) => ({
        url: `suppliers/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Suppliers'],
    }),
  }),
});

export const { useGetSuppliersQuery, useCreateSupplierMutation, useUpdateSupplierMutation } = supplierApi;

const SuppliersList = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: suppliersData, isLoading } = useGetSuppliersQuery({});
  const [createSupplier] = useCreateSupplierMutation();
  const [updateSupplier] = useUpdateSupplierMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', deal_type: 'commission', commission_type: 'percent', commission_rate: 5
  });

  const suppliers = suppliersData?.results || (Array.isArray(suppliersData) ? suppliersData : []);

  // Calculate totals per currency
  const totalBalances: Record<string, {amount: number, symbol: string, name: string}> = {};
  suppliers.forEach((s: any) => {
    if (s.balances && Array.isArray(s.balances)) {
      s.balances.forEach((b: any) => {
        if (!totalBalances[b.currency_code]) {
          totalBalances[b.currency_code] = { amount: 0, symbol: b.currency_symbol, name: b.currency_name };
        }
        totalBalances[b.currency_code].amount += b.amount;
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateSupplier({ id: editingId, ...formData }).unwrap();
      } else {
        await createSupplier(formData).unwrap();
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({name: '', phone: '', deal_type: 'commission', commission_type: 'percent', commission_rate: 5});
    } catch(err) {
      showToast('خطأ في العملية', 'error');
    }
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      name: s.name,
      phone: s.phone || '',
      deal_type: s.deal_type,
      commission_type: s.commission_type || 'percent',
      commission_rate: s.commission_rate || 5
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({name: '', phone: '', deal_type: 'commission', commission_type: 'percent', commission_rate: 5});
  };

  if (isLoading) return <VegetableLoader text="جاري تحميل بيانات المزارعين..." fullScreen />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary">groups</span>
            إدارة المزارعين
          </h2>
          <p className="text-on-surface-variant mt-2 font-bold opacity-70">متابعة حسابات المزارعين، العمولات، والأرصدة الجارية.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform active:scale-95 font-bold text-lg h-[56px]">
          <span className="material-symbols-outlined">person_add</span>
          <span>إضافة مزارع جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-zinc-100 border-r-4 border-r-primary flex justify-between items-center overflow-x-auto">
          <div className="flex gap-8">
            {Object.values(totalBalances).filter(b => b.amount !== 0).map((b) => (
              <div key={b.name}>
                <p className="text-on-surface-variant text-[10px] font-black mb-1 uppercase tracking-tighter">إجمالي {b.name.split(' ')[0]}</p>
                <h3 className={`text-2xl font-black ${b.amount < 0 ? 'text-error' : 'text-primary'}`}>
                  {Math.abs(b.amount).toLocaleString()} <span className="text-xs font-bold">{b.symbol}</span>
                </h3>
              </div>
            ))}
            {Object.values(totalBalances).filter(b => b.amount !== 0).length === 0 && (
              <div>
                <p className="text-on-surface-variant text-[10px] font-black mb-1 uppercase tracking-tighter">إجمالي الذمم</p>
                <h3 className="text-2xl font-black text-primary text-opacity-30">0 <span className="text-xs">₪</span></h3>
              </div>
            )}
          </div>
          <div className="bg-primary/5 p-4 rounded-full flex-shrink-0">
            <span className="material-symbols-outlined text-4xl text-primary">account_balance_wallet</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col justify-center">
          <p className="text-on-surface-variant text-xs font-black mb-1 uppercase tracking-tighter">عدد المزارعين</p>
          <h3 className="text-3xl font-black text-on-surface">{suppliers.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 border-r-4 border-r-secondary flex flex-col justify-center">
           <p className="text-on-surface-variant text-xs font-black mb-1 uppercase tracking-tighter">عملات التعامل</p>
           <div className="flex gap-2 mt-2">
              {Object.keys(totalBalances).length > 0 ? Object.keys(totalBalances).map(code => (
                <span key={code} className="px-2 py-1 bg-secondary-container/20 text-secondary rounded-lg text-[10px] font-black border border-secondary/10">{code}</span>
              )) : <span className="text-zinc-300 text-xs font-bold">ILS فقط</span>}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs font-black uppercase tracking-widest border-b border-zinc-100">
                <th className="px-8 py-5">المزارع</th>
                <th className="px-6 py-5">نوع التعامل</th>
                <th className="px-6 py-5">رصيد الذمة</th>
                <th className="px-6 py-5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {suppliers.map((s: any) => (
                <tr key={s.id} className="hover:bg-zinc-50/30 transition-colors group">
                  <td className="px-8 py-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-lg">{s.name}</div>
                      <div className="text-xs text-zinc-400 font-bold" dir="ltr">{s.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className={`px-4 py-1.5 text-xs font-black rounded-xl border ${s.deal_type === 'commission' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                       {s.deal_type === 'commission' ? 'كمسيون' : 'شراء مباشر'}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-1">
                      {s.balances?.map((b: any) => (
                        b.amount !== 0 && (
                          <div key={b.currency_code} className={`font-black ${b.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {parseFloat(b.amount).toLocaleString()} <span className="text-[10px] opacity-50">{b.currency_symbol}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center flex justify-center gap-2">
                    <button 
                      onClick={() => navigate(`/suppliers/${s.id}/statement`)}
                      className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black hover:scale-105 transition-all flex items-center gap-1 shadow-lg">
                      <span className="material-symbols-outlined text-sm">receipt_long</span> كشف حساب
                    </button>
                    <button 
                      onClick={() => openEdit(s)}
                      className="w-10 h-10 border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 hover:text-primary transition-all">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[200] flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-fade-in border-r border-zinc-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-2xl font-black flex items-center gap-3 text-emerald-950">
                <span className="material-symbols-outlined text-emerald-600 text-4xl">{editingId ? 'edit_note' : 'person_add'}</span>
                {editingId ? 'تعديل بيانات مزارع' : 'إضافة مزارع جديد'}
              </h3>
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 shadow-sm transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 p-8 space-y-6 overflow-y-auto">
              <form id="supplierForm" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">اسم المزارع</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold focus:border-emerald-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">رقم الهاتف</label>
                  <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold text-left focus:border-emerald-600 outline-none transition-all" dir="ltr" type="tel" />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">نوع التعامل</label>
                  <select value={formData.deal_type} onChange={e => setFormData({...formData, deal_type: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold outline-none focus:border-emerald-600">
                    <option value="commission">كمسيون (عمولة)</option>
                    <option value="direct_purchase">شراء مباشر</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="p-8 border-t border-zinc-100 flex gap-4 bg-zinc-50/20">
              <button form="supplierForm" type="submit" className="flex-1 h-14 bg-emerald-700 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all">{editingId ? 'تحديث' : 'حفظ'}</button>
              <button onClick={closeModal} className="px-8 h-14 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-2xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SuppliersList;
