import { useState } from 'react';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ui/Toast';

const coaApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAccountGroups: build.query({
      query: () => 'account-groups/?tree=true',
      providesTags: ['AccountGroups'],
    }),
    createAccountGroup: build.mutation({
      query: (data) => ({
        url: 'account-groups/',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountGroups'],
    }),
    createAccount: build.mutation({
      query: (data) => ({
        url: 'accounts/',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountGroups'],
    }),
  }),
});

export const { 
  useGetAccountGroupsQuery, 
  useCreateAccountGroupMutation, 
  useCreateAccountMutation 
} = coaApi;

export default function ChartOfAccounts() {
  const { showToast } = useToast();
  const { data: groups, isLoading } = useGetAccountGroupsQuery({});
  const [createGroup] = useCreateAccountGroupMutation();
  const [createAccount] = useCreateAccountMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'group' | 'account'>('group');
  const [formData, setFormData] = useState({ name: '', code: '', account_type: 'asset', parent: '', group: '' });

  const handleCreate = async () => {
    try {
      if (modalType === 'group') {
        await createGroup({ 
          name: formData.name, 
          code: formData.code, 
          account_type: formData.account_type, 
          parent: formData.parent || null 
        }).unwrap();
      } else {
        await createAccount({ 
          name: formData.name, 
          code: formData.code, 
          group: formData.group 
        }).unwrap();
      }
      showToast('تمت العملية بنجاح', 'success');
      setIsModalOpen(false);
      setFormData({ name: '', code: '', account_type: 'asset', parent: '', group: '' });
    } catch (err) {
      showToast('خطأ في العملية', 'error');
    }
  };

  const renderGroup = (group: any, depth = 0) => (
    <div key={group.id} className="mb-2" style={{ marginRight: `${depth * 20}px` }}>
      <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer group">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-zinc-400 group-hover:text-primary transition-colors">folder</span>
          <div>
            <span className="font-bold text-zinc-800">{group.code} - {group.name}</span>
            <span className="text-[10px] text-zinc-400 mr-2 uppercase">{group.account_type}</span>
          </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
             onClick={() => {
               setModalType('group');
               setFormData({ ...formData, parent: group.id, account_type: group.account_type });
               setIsModalOpen(true);
             }}
             className="text-[10px] bg-white border border-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-50 font-bold"
           >
             + مجموعة
           </button>
           <button 
             onClick={() => {
               setModalType('account');
               setFormData({ ...formData, group: group.id });
               setIsModalOpen(true);
             }}
             className="text-[10px] bg-primary text-white px-2 py-1 rounded-lg font-bold"
           >
             + حساب
           </button>
        </div>
      </div>
      
      {group.accounts?.map((acc: any) => (
        <div key={acc.id} className="mr-8 mt-1 flex items-center gap-3 p-3 bg-white border border-zinc-50 rounded-lg text-sm text-zinc-600">
          <span className="material-symbols-outlined text-xs text-emerald-600">description</span>
          <span className="font-medium">{acc.code} - {acc.name}</span>
        </div>
      ))}

      {group.subgroups?.map((sub: any) => renderGroup(sub, depth + 1))}
    </div>
  );

  if (isLoading) return <TableSkeleton titleWidth="300px" rows={10} columns={1} />;

  return (
    <div className="space-y-8 animate-fade-in pb-20 no-print" dir="rtl">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-blue-600">account_tree</span>
             شجرة الحسابات (Chart of Accounts)
          </h2>
          <p className="text-zinc-500 font-bold mt-1">الهيكل المالي المتكامل لجميع العمليات والذمم.</p>
        </div>
        <button 
          onClick={() => {
            setModalType('group');
            setFormData({ ...formData, parent: '' });
            setIsModalOpen(true);
          }}
          className="bg-primary text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined">add</span>
          إضافة مجموعة رئيسية
        </button>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-zinc-100">
        {groups?.length > 0 ? (
          groups.map((g: any) => renderGroup(g))
        ) : (
          <div className="p-20 text-center text-zinc-300">
            <span className="material-symbols-outlined text-6xl">account_tree</span>
            <p className="mt-4 font-bold">لا توجد حسابات مسجلة بعد.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h3 className="text-xl font-black text-zinc-800">
                {modalType === 'group' ? 'إضافة مجموعة حسابات' : 'إضافة حساب مالي'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">اسم {modalType === 'group' ? 'المجموعة' : 'الحساب'}</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-primary outline-none transition-all font-bold"
                  placeholder="مثال: ذمم التجار"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">الكود (اختياري)</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-primary outline-none transition-all font-bold"
                  placeholder="مثال: 1101"
                />
              </div>

              {modalType === 'group' && !formData.parent && (
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">نوع الحساب</label>
                  <select 
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-primary outline-none transition-all font-bold"
                  >
                    <option value="asset">أصول</option>
                    <option value="liability">خصوم</option>
                    <option value="equity">حقوق ملكية</option>
                    <option value="revenue">إيرادات</option>
                    <option value="expense">مصروفات</option>
                  </select>
                </div>
              )}
            </div>

            <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex gap-4">
              <button 
                onClick={handleCreate}
                className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                تأكيد الإضافة
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-white text-zinc-500 py-4 rounded-2xl font-black border border-zinc-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
