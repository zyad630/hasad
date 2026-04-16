import { useState } from 'react';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ui/Toast';

// A lightweight list for the dropdown
const statementApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUnifiedStatement: build.query({
      query: ({ type, id, from, to }) => {
          let url = `reports/unified-statement/?type=${type}&id=${id}`;
          if (from) url += `&from=${from}`;
          if (to) url += `&to=${to}`;
          return url;
      },
    }),
    searchParties: build.query({
      query: (q) => `reports/search-parties/?q=${encodeURIComponent(q)}`,
    }),
  }),
});

export const { useGetUnifiedStatementQuery, useSearchPartiesQuery } = statementApi;

export default function UnifiedStatementReport() {
  const { showToast } = useToast();
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const formatDateDisplay = (val: any) => {
    if (!val) return '';
    const s = String(val);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
    if (!m) return s;
    const [, y, mo, d, hm] = m;
    return hm ? `${d}/${mo}/${y} ${hm}` : `${d}/${mo}/${y}`;
  };
  
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 8) + '01';
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);

  const { data: searchResults, isFetching: isSearching } = useSearchPartiesQuery(searchQuery, { skip: searchQuery.length < 2 });
  const { data: report, isLoading, isFetching, isError, error, refetch } = useGetUnifiedStatementQuery(
     { type: targetType, id: targetId, from: dateFrom, to: dateTo }, 
     { skip: !targetId }
  );

  const statement = report?.statement || [];
  const openingBalance = parseFloat(report?.opening_balance || 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!statement.length) {
       showToast('لا توجد بيانات لتصديرها', 'warning');
       return;
    }
    const headers = ["التاريخ", "البيان", "المرجع", "مدين (+)", "دائن (-)", "رصيد تراكمي (شيكل)"];
    const rows = statement.map((r: any) => [
      r.date,
      r.description,
      r.reference,
      r.dr || 0,
      r.cr || 0,
      r.balance,
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n"
      + rows.map((e: any[]) => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `statement_${targetType}_${targetId.substring(0,6)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 no-print" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-purple-600">receipt_long</span>
             كشف الحساب الموحد (Unified Statement)
          </h2>
          <p className="text-zinc-500 font-bold mt-1">يُظهر جميع الحركات مسعرة بالعملة الأساسية (شيكل) والعملة الأجنبية للتاجر أو المزارع.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={handlePrint} className="bg-white border-2 border-zinc-100 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:bg-zinc-50 transition-all shadow-sm">
              <span className="material-symbols-outlined">print</span>
              طباعة كشف
           </button>
           <button onClick={handleExportExcel} className="bg-emerald-600 text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/20">
              <span className="material-symbols-outlined">description</span>
              تصدير إكسيل
           </button>
        </div>
      </header>

      {/* Filters Form */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
         <div className="md:col-span-2 relative">
            <label className="block text-sm font-black text-zinc-500 mb-2">البحث الشامل (اسم أو رقم، يشمل جميع الحسابات)</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">search</span>
              <input 
                type="text" 
                placeholder="ابحث عن مزارع، تاجر، موظف، أو شريك..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl pr-12 pl-5 py-3 focus:border-purple-600 outline-none transition-all font-bold text-sm" 
              />
            </div>
            
            {/* Search Results Dropdown */}
            {isSearching && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden max-h-64 overflow-y-auto">
                <div className="p-4 text-center">
                   <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              </div>
            )}
            
            {!isSearching && searchResults?.results && searchResults.results.length > 0 && searchQuery && !targetId && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden max-h-64 overflow-y-auto">
                {searchResults.results.map((r: any) => (
                  <button 
                    key={`${r.type}-${r.id}`}
                    onClick={() => {
                        setTargetType(r.type);
                        setTargetId(r.id);
                        setTargetName(r.name);
                        setSearchQuery(r.name);
                    }}
                    className="w-full text-right px-5 py-3 hover:bg-zinc-50 flex items-center justify-between border-b border-zinc-50 last:border-0 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-zinc-800">{r.name}</div>
                      {r.phone && <div className="text-xs text-zinc-400 mt-1" dir="ltr">{r.phone}</div>}
                    </div>
                    <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      {r.type_label}
                    </span>
                  </button>
                ))}
              </div>
            )}
         </div>

         <div>
            <label className="block text-sm font-black text-zinc-500 mb-2">من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-purple-600 outline-none transition-all font-bold text-sm" />
         </div>

         <div>
            <label className="block text-sm font-black text-zinc-500 mb-2">إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl px-5 py-3 focus:border-purple-600 outline-none transition-all font-bold text-sm" />
         </div>
         {targetId && (
            <div className="md:col-span-4 flex items-center justify-between bg-purple-50 p-4 rounded-2xl mt-2 border border-purple-100">
               <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-purple-600">account_circle</span>
                  <div>
                    <span className="text-sm font-black text-purple-900 block">عرض كشف حساب: {targetName}</span>
                    <span className="text-xs text-purple-600 font-bold">يمكنك مسح الإدخال للبحث عن حساب آخر</span>
                  </div>
               </div>
               <button onClick={() => {
                  setTargetId('');
                  setTargetType('');
                  setTargetName('');
                  setSearchQuery('');
               }} className="text-rose-500 hover:text-rose-700 font-bold text-sm bg-white px-3 py-1.5 rounded-xl shadow-sm">
                  إلغاء التحديد
               </button>
            </div>
         )}
      </div>

      {/* Report Table */}
      {targetId && isLoading || isFetching ? (
         <TableSkeleton titleWidth="200px" rows={10} columns={7} />
      ) : targetId && isError ? (
         <div className="bg-rose-50 p-8 rounded-3xl text-center border border-rose-100">
            <span className="material-symbols-outlined text-6xl text-rose-200 mb-4">error</span>
            <h3 className="text-xl font-black text-rose-700">تعذر تحميل كشف الحساب</h3>
            <p className="text-sm font-bold text-rose-600 mt-2">
              {(error as any)?.data?.detail || (error as any)?.data?.error || (error as any)?.error || 'حدث خطأ أثناء الاتصال بالخادم.'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-5 bg-white border-2 border-rose-100 px-6 py-3 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all"
            >
              إعادة المحاولة
            </button>
         </div>
      ) : targetId && statement.length > 0 ? (
         <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-zinc-100">
           {/* Report Info Head */}
           <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center print-header">
               <div>
                 <h3 className="text-xl font-black">كشف حساب: {targetName}</h3>
                 <p className="text-sm font-bold text-zinc-500">نوع الحساب يعتمد على التحديد • الرصيد الإجمالي المعادل بالشيكل: <span className="text-purple-700">{report?.total_balance_base} ₪</span></p>
              </div>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-right border-collapse print-table font-code">
               <thead>
                 <tr className="bg-white text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-200">
                   <th className="px-6 py-4">التاريخ</th>
                   <th className="px-6 py-4">البيان والمرجع</th>
                   <th className="px-6 py-4 border-r border-zinc-100 bg-purple-50/30 text-purple-700">مدين (+) بالأساسي</th>
                   <th className="px-6 py-4 bg-purple-50/30 text-purple-700">دائن (-) بالأساسي</th>
                   <th className="px-6 py-4 border-r border-zinc-100 bg-zinc-50 font-black">رصيد تراكمي (شيكل)</th>
                 </tr>
               </thead>
                              <tbody className="divide-y divide-zinc-50">
                   {dateFrom && (
                     <tr className="bg-zinc-100/50 font-black italic">
                       <td className="px-6 py-4 text-xs text-zinc-400" dir="ltr">{formatDateDisplay(dateFrom)}</td>
                       <td className="px-6 py-4 text-sm text-zinc-500 italic">رصيد قبل الفترة (Opening Balance)</td>
                       <td className="px-6 py-4 border-r border-zinc-100 italic">{openingBalance.toLocaleString()} ₪</td>
                       <td className="px-6 py-4 italic">---</td>
                       <td className="px-6 py-4 border-r border-zinc-100 bg-zinc-100 font-black text-rose-600">
                         {openingBalance.toLocaleString()} ₪
                       </td>
                     </tr>
                   )}
                  {statement.map((s: any, idx: number) => {
                     return (
                        <tr key={idx} className={`hover:bg-zinc-50/50 transition-colors ${s.is_realtime ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-6 py-4 text-xs font-bold text-zinc-500 whitespace-nowrap" dir="ltr">{formatDateDisplay(s.date)}</td>
                          <td className="px-6 py-4">
                             <div className="font-bold text-sm text-zinc-800">{s.description}</div>
                             <div className="text-[10px] text-zinc-400 mt-1 uppercase">{s.reference}</div>
                             {s.is_realtime && (
                               <div className="flex items-center gap-1 mt-1">
                                 <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                 <span className="text-[10px] text-amber-600 font-black">قيد التصفية</span>
                               </div>
                             )}
                          </td>
                          {/* Base Equivalent DR */}
                          <td className={`px-6 py-4 text-sm font-black border-r border-zinc-100 bg-rose-50/20 ${s.dr > 0 ? 'text-rose-600' : 'text-zinc-300'}`}>
                             {s.dr > 0 ? Number(s.dr).toLocaleString() : ''}
                          </td>
                          {/* Base Equivalent CR */}
                          <td className={`px-6 py-4 text-sm font-black border-r border-zinc-100 bg-emerald-50/20 ${s.cr > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                             {s.cr > 0 ? Number(s.cr).toLocaleString() : ''}
                          </td>
                          {/* Running Balance */}
                          <td className={`px-6 py-4 text-sm font-black border-r border-zinc-100 bg-zinc-50 ${Number(s.balance) >= 0 ? 'text-zinc-800' : 'text-rose-600'}`}>
                             {Number(s.balance).toLocaleString()} ₪
                          </td>
                        </tr>
                     );
                  })}
               </tbody>
             </table>
           </div>
         </div>
      ) : targetId ? (
         <div className="bg-white p-10 rounded-3xl text-center border border-zinc-100">
            <span className="material-symbols-outlined text-6xl text-zinc-200 mb-4">folder_open</span>
            <h3 className="text-xl font-black text-zinc-400">لا توجد حركات مالية مسجلة لهذا الحساب</h3>
         </div>
      ) : null}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-family: sans-serif; }
          .print-table { width: 100% !important; border: 1px solid #ccc !important; font-size: 11px !important; }
          .print-table th, .print-table td { border: 1px solid #ddd !important; padding: 6px !important; }
          .print-header { display: block !important; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        }
      `}</style>
    </div>
  );
}
