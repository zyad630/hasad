import React, { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/baseApi';
import { VegetableLoader } from '../../components/ui/VegetableLoader';

const customerApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query({
      query: (params: any) => ({ url: 'customers/', params: params && typeof params === 'object' && Object.keys(params).length > 0 ? params : undefined }),
      providesTags: ['Customers'],
    }),
    createCustomer: build.mutation({
      query: (body) => ({
        url: 'customers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Customers'],
    }),
    updateCustomer: build.mutation({
      query: ({ id, ...body }) => ({
        url: `customers/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Customers'],
    }),
  }),
});

export const { useGetCustomersQuery, useCreateCustomerMutation, useUpdateCustomerMutation } = customerApi;

const CustomersList = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { data: customersData, isLoading } = useGetCustomersQuery({});
  const [createCustomer] = useCreateCustomerMutation();
  const [updateCustomer] = useUpdateCustomerMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', customer_type: 'trader', credit_limit: 0
  });

  const customers = customersData?.results || (Array.isArray(customersData) ? customersData : []);

  // Calculate totals per currency
  const totalCredits: Record<string, {amount: number, symbol: string, name: string}> = {};
  customers.forEach((c: any) => {
    if (c.balances && Array.isArray(c.balances)) {
      c.balances.forEach((b: any) => {
        if (!totalCredits[b.currency_code]) {
          totalCredits[b.currency_code] = { amount: 0, symbol: b.currency_symbol, name: b.currency_name };
        }
        totalCredits[b.currency_code].amount += b.amount;
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCustomer({ id: editingId, ...formData }).unwrap();
        showToast('تم تعديل بيانات الزبون بنجاح', 'success');
      } else {
        await createCustomer(formData).unwrap();
        showToast('تم إضافة الزبون بنجاح ✓', 'success');
      }
      closeModal();
    } catch(err: any) {
      const detail = err?.data ? JSON.stringify(err.data) : 'تحقق من البيانات';
      showToast(`خطأ: ${detail}`, 'error');
    }
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      customer_type: c.customer_type,
      credit_limit: c.credit_limit || 0
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', phone: '', customer_type: 'trader', credit_limit: 0 });
  };

  if (isLoading) return <VegetableLoader text="جاري تحميل كشوفات الزبائن والتجار..." fullScreen />;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-emerald-600">person_search</span>
            إدارة الزبائن / تجار
          </h2>
          <p className="text-on-surface-variant mt-2 font-bold opacity-70">متابعة حسابات الزبائن، المديونيات، والأرصدة الجارية.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-2xl shadow-xl shadow-emerald-900/20 hover:scale-105 transition-transform font-bold text-lg h-[56px]">
          <span className="material-symbols-outlined">person_add</span>
          <span>إضافة زبون جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 border-r-4 border-r-emerald-600 flex justify-between items-center overflow-x-auto">
          <div className="flex gap-8">
            {Object.values(totalCredits).filter(b => b.amount !== 0).map((b) => (
              <div key={b.name}>
                <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">إجمالي مديونية {b.name.split(' ')[0]}</p>
                <h3 className={`text-2xl font-black ${b.amount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {Math.abs(b.amount).toLocaleString()} <span className="text-xs font-bold">{b.symbol}</span>
                </h3>
              </div>
            ))}
            {Object.values(totalCredits).filter(b => b.amount !== 0).length === 0 && (
              <div>
                <h3 className="text-2xl font-black text-zinc-200">0.00 <span className="text-xs">₪</span></h3>
              </div>
            )}
          </div>
          <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100">
            <span className="material-symbols-outlined text-4xl text-emerald-600">account_balance_wallet</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 flex flex-col justify-center">
          <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">عدد الزبائن</p>
          <h3 className="text-3xl font-black text-on-surface">{customers.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 border-r-4 border-r-indigo-500 flex flex-col justify-center">
           <p className="text-zinc-400 text-[10px] font-black mb-1 uppercase tracking-tighter">إجمالي حدود الائتمان</p>
           <div className="text-indigo-600 font-black text-2xl" dir="ltr">
             {customers.reduce((sum: number, c: any) => sum + (parseFloat(c.credit_limit) || 0), 0).toLocaleString()} <span className="text-sm">₪</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/30 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                <th className="px-8 py-5">الزبون / تاجر</th>
                <th className="px-6 py-5">التصنيف</th>
                <th className="px-6 py-5">الديون (لنا)</th>
                <th className="px-6 py-5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {customers.map((c: any) => (
                <tr key={c.id} className="hover:bg-zinc-50/50 group transition-colors">
                  <td className="px-8 py-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xl border border-indigo-100 shadow-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-lg leading-tight">{c.name}</div>
                      <div className="text-xs text-zinc-400 font-bold" dir="ltr">{c.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="px-4 py-1 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase">
                       {c.customer_type === 'trader' ? 'تاجر جملة' : c.customer_type === 'retail' ? 'محل تجزئة' : 'فردي'}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-1">
                      {c.balances?.map((b: any) => (
                        b.amount !== 0 && (
                          <div key={b.currency_code} className={`font-black text-base flex items-center gap-1 ${b.amount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {Math.abs(parseFloat(b.amount)).toLocaleString()} <span className="text-[10px] opacity-40">{b.currency_symbol}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center flex justify-center gap-2">
                    <button className="px-4 py-2 bg-white border-2 border-emerald-600 text-emerald-700 rounded-xl text-xs font-black shadow-sm flex items-center gap-1 hover:bg-emerald-600 hover:text-white transition-all">
                      <span className="material-symbols-outlined text-[1rem]">receipt_long</span> كشف حساب
                    </button>
                    <button 
                      onClick={() => openEdit(c)}
                      className="w-10 h-10 border border-zinc-200 rounded-xl text-zinc-400 hover:text-indigo-600 transition-all flex items-center justify-center">
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
              <h3 className="text-2xl font-black flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-emerald-600">{editingId ? 'edit_square' : 'person_add'}</span>
                {editingId ? 'تعديل بيانات زبون' : 'إضافة زبون جديد'}
              </h3>
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-zinc-400 hover:text-rose-600 shadow-sm transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 p-8 space-y-6 overflow-y-auto">
              <form id="customerForm" onSubmit={handleSubmit} className="space-y-6 w-full">
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">اسم الزبون / تاجر</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold focus:border-emerald-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">رقم الهاتف</label>
                  <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold text-left focus:border-emerald-600 outline-none transition-all" dir="ltr" type="tel" placeholder="05xxxxxxxx" />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-400 mb-2 uppercase">التصنيف</label>
                  <select value={formData.customer_type} onChange={e => setFormData({...formData, customer_type: e.target.value})} className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 h-14 font-bold outline-none focus:border-emerald-600">
                    <option value="trader">تاجر / جملة</option>
                    <option value="retail">محل / تجزئة</option>
                    <option value="individual">فردي</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="p-8 border-t border-zinc-100 flex gap-4 bg-zinc-50/20">
              <button form="customerForm" type="submit" className="flex-1 h-14 bg-emerald-700 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] transition-all">
                {editingId ? 'تعديل وحفظ' : 'إضافة زبون'}
              </button>
              <button onClick={closeModal} className="px-8 h-14 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-2xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default CustomersList;
