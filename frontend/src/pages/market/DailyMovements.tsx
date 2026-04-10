import { useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import { createPortal } from 'react-dom';
import { api } from '../../api/baseApi';
import { TableSkeleton } from '../../components/Skeleton';
import { useGetSuppliersQuery } from '../suppliers/Suppliers';
import { useGetCustomersQuery } from '../suppliers/Customers';
import { useGetCurrenciesQuery } from '../settings/Currencies';

const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query({
      query: () => 'inventory/items/',
    }),
  }),
});

export const { useGetItemsQuery } = inventoryApi;

const marketApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMovements: build.query({
      query: (date) => `market/movements/?date=${date || ''}`,
      providesTags: (result: any) => 
        result ? [...result.map(({ id }: any) => ({ type: 'Movements' as const, id })), 'Movements'] : ['Movements'],
    }),
    createMovement: build.mutation({
      query: (body) => ({
        url: 'market/movements/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Movements', 'Cash', 'Suppliers', 'Customers'],
    }),
  }),
});

export const { useGetMovementsQuery, useCreateMovementMutation } = marketApi;

export default function DailyMovements() {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: movements, isLoading } = useGetMovementsQuery(selectedDate);
  const { data: suppliers } = useGetSuppliersQuery({});
  const { data: customers } = useGetCustomersQuery({});
  const { data: currenciesData } = useGetCurrenciesQuery({});
  const { data: itemsData } = useGetItemsQuery({});
  const [createMovement] = useCreateMovementMutation();

  const currencies = currenciesData || [];
  const itemsList = itemsData?.results || itemsData || [];

  // ── All state declarations ──────────────────────────────────────────────────
  const [newRow, setNewRow] = useState<any>({
    supplier: '', item_name: '', unit: '', count: '',
    gross_weight: '', net_weight: '', purchase_price: '',
    commission_rate: 5, buyer: '', sale_qty: '', sale_price: '',
    box_price: 0, currency: '', cash_received: '', check_received: '',
    expense_amount: ''
  });

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [tempChecks, setTempChecks] = useState<any[]>([]);

  // ── Handler functions (declared after state) ──────────────────────────────
  const handleItemChange = (val: string) => {
    const item = itemsList.find((i: any) => i.name === val);
    setNewRow((prev: any) => ({
      ...prev,
      item_name: val,
      box_price: item ? item.box_price : prev.box_price
    }));
  };

  const handleOpenCheckModal = () => {
    if (parseFloat(newRow.check_received || 0) > 0) {
      if (tempChecks.length === 0) {
        setTempChecks([{ check_number: '', bank_name: '', due_date: new Date().toISOString().split('T')[0], amount: newRow.check_received }]);
      }
      setIsCheckModalOpen(true);
    }
  };

  const handleSave = async () => {
    if (!newRow.supplier || !newRow.item_name) {
       showToast('يرجى اختيار المزارع والصنف', 'warning');
       return;
    }
    
    // Check if check_received matches tempChecks sum
    if (parseFloat(newRow.check_received || 0) > 0) {
      const totalChecks = tempChecks.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
      if (Math.abs(totalChecks - parseFloat(newRow.check_received)) > 0.01) {
        showToast(`مجموع مبالغ الشيكات لا يتساوى مع القيمة المدخلة (${newRow.check_received})`, 'warning');
        setIsCheckModalOpen(true);
        return;
      }
    }

    try {
      await createMovement({
        ...newRow,
        checks_details: tempChecks
      }).unwrap();
      setNewRow({
        ...newRow,
        item_name: '', count: 0, gross_weight: 0, net_weight: 0,
        purchase_price: 0, buyer: '', sale_qty: 0, sale_price: 0,
        cash_received: 0, check_received: 0, expense_amount: 0
      });
      setTempChecks([]);
    } catch (err: any) {
      if (err?.data && !err?.data?.detail) {
         const errorMsgs = Object.entries(err.data).map(([k, v]) => {
            if (Array.isArray(v)) return `${k}: ${v.join(', ')}`;
            return `${k}: ${v}`;
         }).join(' | ');
         showToast(errorMsgs, 'error');
      } else {
         showToast(err?.data?.detail || 'حدث خطأ في الحفظ', 'error');
      }
    }
  };

  const handleVoiceInput = () => {
    const mockTranscript = prompt("قل مثلاً: (أحمد باع 10 كراتين بندورة بسعر 5 شيكل لرامي)");
    if (!mockTranscript) return;
    
    setIsVoiceModalOpen(true);
    setVoiceText(mockTranscript);
    setIsAnalysing(true);
    
    setTimeout(() => {
      setIsAnalysing(false);
      // Mock logic: looking for keywords
      if (mockTranscript.includes('بندورة')) {
         setNewRow({
           ...newRow,
           item_name: 'بندورة',
           count: 10,
           purchase_price: 5,
           sale_price: 6,
           sale_qty: 10
         });
      }
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const flow = [
        'expense_amount', 'supplier', 'item_name', 'count', 
        'gross_weight', 'net_weight', 'purchase_price', 
        'buyer', 'sale_qty', 'sale_price', 'box_price', 'cash_received'
      ];
      const currentIndex = flow.indexOf(field);
      if (currentIndex > -1 && currentIndex < flow.length - 1) {
        const nextField = flow[currentIndex + 1];
        document.getElementById(`nr-${nextField}`)?.focus();
      } else if (currentIndex === flow.length - 1) {
        handleSave();
      }
    }
  };

  if (isLoading) return <TableSkeleton titleWidth="300px" rows={10} columns={10} />;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
             <span className="material-symbols-outlined text-4xl text-primary">analytics</span>
             ساحة الحركات اليومية
          </h2>
          <p className="text-zinc-500 font-bold mt-1">تسجيل مبيعات ومشتريات ومصاريف المزارعين والزبائن في مكان واحد.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleVoiceInput}
             className="flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-rose-600/20 hover:scale-105 transition-all">
              <span className="material-symbols-outlined">mic</span>
              إدخال صوتي (AI)
           </button>
           <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-zinc-100 items-center gap-4">
              <input 
                type="date" 
                className="bg-transparent border-none outline-none font-bold text-zinc-600 px-4"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
           </div>
        </div>
      </header>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[1800px]">
               <thead>
                  <tr className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 font-cairo">
                     <th className="px-4 py-4 w-15 italic">رقم</th>
                     <th className="px-4 py-4 w-32 border-l border-zinc-100 bg-rose-50/30 text-rose-700 font-black">صرف / دفع</th>
                     <th className="px-4 py-4 w-56 font-black">المزارع (المورد)</th>
                     <th className="px-4 py-4 w-40 font-black">الصنف</th>
                     <th className="px-4 py-4 w-28 font-black">العدد</th>
                     <th className="px-4 py-4 w-32 font-black">قائم | صافي</th>
                     <th className="px-4 py-4 w-32 font-black">سعر الشراء</th>
                     <th className="px-4 py-4 w-32 bg-emerald-50/30 text-emerald-700 font-black">إجمالي | كمسيون</th>
                     <th className="px-4 py-4 w-56 border-r border-zinc-100 font-black">المشتري (الزبون)</th>
                     <th className="px-4 py-4 w-28 font-black">كمية بيع</th>
                     <th className="px-4 py-4 w-28 font-black">سعر بيع</th>
                     <th className="px-4 py-4 w-32 bg-indigo-50/30 text-indigo-700 font-black">إجمالي البيع</th>
                     <th className="px-4 py-4 w-28 font-black">ثمن كرتون</th>
                     <th className="px-4 py-4 w-32 font-black">نقد / شيك</th>
                     <th className="px-4 py-4 w-20 text-center font-black">إجراء</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-zinc-50">
                  {/* Matrix Entry Row */}
                  <tr className="bg-primary/5 border-b-2 border-primary/10 group focus-within:bg-primary/10 transition-colors">
                     <td className="px-4 py-3"><div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-xs">جديد</div></td>
                     <td className="px-4 py-3 border-l border-zinc-100">
                        <div className="flex flex-col gap-1">
                           <input id="nr-expense_amount" onKeyDown={e => handleKeyDown(e, 'expense_amount')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center text-rose-600 focus:ring-2 focus:ring-rose-500" placeholder="0.00" value={newRow.expense_amount} onChange={e => setNewRow({...newRow, expense_amount: e.target.value})} />
                           <select className="text-[10px] bg-transparent border-none font-bold text-zinc-400" value={newRow.currency} onChange={e => setNewRow({...newRow, currency: e.target.value})}>
                              <option value="" disabled>العملة</option>
                              {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                        </div>
                     </td>
                     <td className="px-4 py-3">
                        <select id="nr-supplier" onKeyDown={e => handleKeyDown(e, 'supplier')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-bold" value={newRow.supplier} onChange={e => setNewRow({...newRow, supplier: e.target.value})}>
                           <option value="">المزارع...</option>
                           {(suppliers?.results || suppliers || []).map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                     </td>
                     <td className="px-4 py-3">
                        <input 
                           id="nr-item_name"
                           onKeyDown={e => handleKeyDown(e, 'item_name')}
                           list="items-list"
                           className="w-full bg-white border-zinc-200 rounded-lg p-2 font-bold" 
                           placeholder="الصنف..." 
                           value={newRow.item_name} 
                           onChange={e => handleItemChange(e.target.value)} 
                        />
                        <datalist id="items-list">
                           {itemsList.map((it:any) => <option key={it.id} value={it.name} />)}
                        </datalist>
                     </td>
                     <td className="px-4 py-3">
                          <input id="nr-count" onKeyDown={e => handleKeyDown(e, 'count')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center" value={newRow.count} onChange={e => setNewRow({...newRow, count: e.target.value})} />
                     </td>
                     <td className="px-4 py-3">
                          <div className="flex gap-1">
                             <input id="nr-gross_weight" onKeyDown={e => handleKeyDown(e, 'gross_weight')} className="w-1/2 bg-white border-zinc-200 rounded-lg p-1 text-[10px] font-black" placeholder="قائم" value={newRow.gross_weight} onChange={e => setNewRow({...newRow, gross_weight: e.target.value})} />
                             <input id="nr-net_weight" onKeyDown={e => handleKeyDown(e, 'net_weight')} className="w-1/2 bg-white border-zinc-200 rounded-lg p-1 text-[10px] font-black" placeholder="صافي" value={newRow.net_weight} onChange={e => setNewRow({...newRow, net_weight: e.target.value})} />
                          </div>
                     </td>
                     <td className="px-4 py-3">
                          <input id="nr-purchase_price" onKeyDown={e => handleKeyDown(e, 'purchase_price')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center" value={newRow.purchase_price} onChange={e => setNewRow({...newRow, purchase_price: e.target.value})} />
                     </td>
                     <td className="px-4 py-3 bg-emerald-50/10">
                          <div className="text-[10px] font-black text-emerald-800 text-center">
                             {(parseFloat(newRow.net_weight || 0) * parseFloat(newRow.purchase_price || 0)).toLocaleString()}
                             <div className="text-[9px] text-zinc-400 mt-1 uppercase">كمسيون: {newRow.commission_rate}%</div>
                          </div>
                     </td>
                     <td className="px-4 py-3 border-r border-zinc-100">
                        <select id="nr-buyer" onKeyDown={e => handleKeyDown(e, 'buyer')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-bold" value={newRow.buyer} onChange={e => setNewRow({...newRow, buyer: e.target.value})}>
                           <option value="">المشتري...</option>
                           {(customers?.results || customers || []).map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                     </td>
                     <td className="px-4 py-3">
                        <input id="nr-sale_qty" onKeyDown={e => handleKeyDown(e, 'sale_qty')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center" value={newRow.sale_qty} onChange={e => setNewRow({...newRow, sale_qty: e.target.value})} />
                     </td>
                     <td className="px-4 py-3">
                        <input id="nr-sale_price" onKeyDown={e => handleKeyDown(e, 'sale_price')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center" value={newRow.sale_price} onChange={e => setNewRow({...newRow, sale_price: e.target.value})} />
                     </td>
                     <td className="px-4 py-3 bg-indigo-50/10 text-center">
                        <div className="text-xs font-black text-indigo-700">
                           {( (parseFloat(newRow.sale_qty || 0) * parseFloat(newRow.sale_price || 0)) + (parseFloat(newRow.count || 0) * parseFloat(newRow.box_price || 0)) ).toLocaleString()}
                        </div>
                     </td>
                     <td className="px-4 py-3">
                        <input id="nr-box_price" onKeyDown={e => handleKeyDown(e, 'box_price')} className="w-full bg-white border-zinc-200 rounded-lg p-2 font-black text-center text-zinc-400 text-xs" value={newRow.box_price} onChange={e => setNewRow({...newRow, box_price: e.target.value})} />
                     </td>
                     <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 relative group">
                           <input id="nr-cash_received" onKeyDown={e => handleKeyDown(e, 'cash_received')} title="Cash" className="w-full bg-white border-zinc-200 rounded-lg p-1 text-[10px] font-black text-emerald-600 text-center" placeholder="نقدي" value={newRow.cash_received} onChange={e => setNewRow({...newRow, cash_received: e.target.value})} />
                           <div className="relative">
                              <input 
                                title="Check" 
                                id="nr-check_received"
                                className="w-full bg-white border-zinc-200 rounded-lg p-1 text-[10px] font-black text-indigo-600 text-center pr-6" 
                                placeholder="شيك" 
                                value={newRow.check_received} 
                                onChange={e => setNewRow({...newRow, check_received: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && handleOpenCheckModal()}
                              />
                              <button 
                                onClick={handleOpenCheckModal}
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600">
                                 <span className="material-symbols-outlined text-[14px]">payments</span>
                              </button>
                           </div>
                        </div>
                     </td>
                     <td className="px-4 py-3 text-center">
                        <button onClick={handleSave} className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                           <span className="material-symbols-outlined">add</span>
                        </button>
                     </td>
                  </tr>

                  {/* Movements List */}
                  {(movements || []).map((m: any) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors animate-slide-up">
                       <td className="px-4 py-5 font-black text-zinc-400 text-xs text-center italic">#{m.daily_seq}</td>
                       <td className="px-4 py-5 border-l border-zinc-100 font-black text-rose-600 text-center">{parseFloat(m.expense_amount).toLocaleString()}</td>
                       <td className="px-4 py-5 font-bold text-zinc-700">{m.supplier_name}</td>
                       <td className="px-4 py-5 font-bold text-zinc-500">{m.item_name}</td>
                       <td className="px-4 py-5 font-black text-center text-zinc-700">{m.count}</td>
                       <td className="px-4 py-5">
                          <div className="flex flex-col items-center">
                             <span className="text-[10px] text-zinc-300">قائم: {m.gross_weight}</span>
                             <span className="text-xs font-black text-zinc-500">{m.net_weight}</span>
                          </div>
                       </td>
                       <td className="px-4 py-5 font-black text-center text-zinc-700">{parseFloat(m.purchase_price).toLocaleString()}</td>
                       <td className="px-4 py-5 bg-emerald-50/5">
                          <div className="flex flex-col items-center">
                             <div className="font-black text-emerald-700 text-sm">{parseFloat(m.purchase_total).toLocaleString()}</div>
                             <div className="text-[9px] text-zinc-400">كمسيون: {parseFloat(m.commission_amount).toLocaleString()}</div>
                          </div>
                       </td>
                       <td className="px-4 py-5 border-r border-zinc-100 font-bold text-indigo-900">{m.buyer_name || '---'}</td>
                       <td className="px-4 py-5 font-black text-center text-indigo-700">{m.sale_qty}</td>
                       <td className="px-4 py-5 font-black text-center text-indigo-700">{parseFloat(m.sale_price).toLocaleString()}</td>
                       <td className="px-4 py-5 bg-indigo-50/5">
                          <div className="font-black text-indigo-800 text-center">{parseFloat(m.sale_total).toLocaleString()}</div>
                       </td>
                       <td className="px-4 py-5 font-black text-center text-zinc-400 text-xs italic">{parseFloat(m.box_price).toLocaleString()}</td>
                       <td className="px-4 py-5">
                          <div className="flex flex-col items-center text-[10px]">
                             <span className="text-emerald-600 font-black">ن: {parseFloat(m.cash_received).toLocaleString()}</span>
                             <span className="text-indigo-600 font-black">ش: {parseFloat(m.check_received).toLocaleString()}</span>
                          </div>
                       </td>
                       <td className="px-4 py-5 text-center">
                          <button className="w-8 h-8 rounded-full text-zinc-300 hover:text-emerald-600 transition-colors">
                             <span className="material-symbols-outlined text-sm">receipt</span>
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Voice Processing Helper (Modal) */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 text-center animate-scale-in">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <span className={`material-symbols-outlined text-4xl text-rose-600 ${isAnalysing ? 'animate-pulse' : ''}`}>mic</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">{isAnalysing ? 'جاري تحليل الصوت...' : 'تم المعالجة بنجاح'}</h3>
              <p className="text-zinc-500 font-bold mb-8 italic">"{voiceText}"</p>
              
              {!isAnalysing && (
                <button 
                  onClick={() => setIsVoiceModalOpen(false)}
                  className="w-full bg-emerald-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-900/10 transition-all hover:scale-[1.02]">
                   إضافة البيانات للجدول
                </button>
              )}
           </div>
        </div>
      )}

      {/* Check Details Modal */}
      {isCheckModalOpen && createPortal(
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white max-w-2xl w-full rounded-[2.5rem] p-8 shadow-2xl animate-scale-in">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-black text-indigo-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-4xl">payments</span>
                    تفاصيل الشيكات الواردة
                 </h3>
                 <div className="bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 font-black">
                    المجموع المطلوب: {parseFloat(newRow.check_received).toLocaleString()} ₪
                 </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto mb-6 pr-2">
                 {tempChecks.map((chk, idx) => (
                   <div key={idx} className="grid grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-2xl relative border border-zinc-100">
                      <div>
                         <label className="text-[10px] font-black text-zinc-400 block mb-1">رقم الشيك</label>
                         <input className="w-full bg-white border-zinc-200 rounded-xl p-2 font-bold text-sm" value={chk.check_number} onChange={e => {
                            const nc = [...tempChecks]; nc[idx].check_number = e.target.value; setTempChecks(nc);
                         }} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-zinc-400 block mb-1">البنك</label>
                         <input className="w-full bg-white border-zinc-200 rounded-xl p-2 font-bold text-sm" value={chk.bank_name} onChange={e => {
                            const nc = [...tempChecks]; nc[idx].bank_name = e.target.value; setTempChecks(nc);
                         }} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-zinc-400 block mb-1">تاريخ الاستحقاق</label>
                         <input type="date" className="w-full bg-white border-zinc-200 rounded-xl p-2 font-bold text-sm" value={chk.due_date} onChange={e => {
                            const nc = [...tempChecks]; nc[idx].due_date = e.target.value; setTempChecks(nc);
                         }} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-zinc-400 block mb-1">المبلغ</label>
                         <div className="flex gap-2">
                            <input type="number" className="w-full bg-white border-zinc-200 rounded-xl p-2 font-black text-sm text-indigo-600" value={chk.amount} onChange={e => {
                               const nc = [...tempChecks]; nc[idx].amount = e.target.value; setTempChecks(nc);
                            }} />
                            {tempChecks.length > 1 && (
                              <button onClick={() => setTempChecks(tempChecks.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600">
                                 <span className="material-symbols-outlined">delete</span>
                              </button>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="flex justify-between items-center bg-zinc-50 p-6 rounded-3xl mb-8">
                 <button 
                   onClick={() => setTempChecks([...tempChecks, { check_number: '', bank_name: '', due_date: new Date().toISOString().split('T')[0], amount: 0 }])}
                   className="flex items-center gap-2 text-indigo-700 font-black text-sm hover:underline">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    إضافة شيك آخر
                 </button>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-zinc-400 uppercase">مجموع الشيكات المدخلة</span>
                    <span className={`text-2xl font-black ${Math.abs(tempChecks.reduce((s,c)=>s+parseFloat(c.amount||0), 0) - parseFloat(newRow.check_received)) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {tempChecks.reduce((s,c)=>s+parseFloat(c.amount||0), 0).toLocaleString()} <span className="text-xs">₪</span>
                    </span>
                 </div>
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={() => {
                      const total = tempChecks.reduce((s,c)=>s+parseFloat(c.amount||0), 0);
                      if (Math.abs(total - parseFloat(newRow.check_received)) > 0.01) {
                        showToast(`يجب أن يكون مجموع مبالغ الشيكات مساوياً للمبلغ الإجمالي (${newRow.check_received})`, 'warning');
                        return;
                      }
                      setIsCheckModalOpen(false);
                   }}
                   className="flex-1 bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-900/10 hover:scale-[1.02] active:scale-95 transition-all">
                    تأكيد وحفظ التفاصيل
                 </button>
                 <button 
                    onClick={() => setIsCheckModalOpen(false)}
                    className="px-8 bg-zinc-100 text-zinc-500 rounded-2xl font-bold hover:bg-zinc-200 transition-colors">
                    إلغاء
                 </button>
              </div>
           </div>
        </div>
      , document.body)}

      {/* Stats Summary Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">إجمالي مبيعات الساحة</p>
            <h3 className="text-3xl font-black text-indigo-700 mt-1">{(movements || []).reduce((sum:number, m:any) => sum+parseFloat(m.sale_total),0).toLocaleString()} <span className="text-xs">₪</span></h3>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-indigo-500/5 group-hover:scale-110 duration-500 transition-transform">point_of_sale</span>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">عمولات الحسبة اليوم</p>
            <h3 className="text-3xl font-black text-emerald-700 mt-1">{(movements || []).reduce((sum:number, m:any) => sum+parseFloat(m.commission_amount),0).toLocaleString()} <span className="text-xs">₪</span></h3>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-emerald-500/5 group-hover:scale-110 duration-500 transition-transform">percent</span>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">إجمالي القبض النقدي</p>
            <h3 className="text-3xl font-black text-emerald-600 mt-1">{(movements || []).reduce((sum:number, m:any) => sum+parseFloat(m.cash_received),0).toLocaleString()} <span className="text-xs">₪</span></h3>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-emerald-600/5 group-hover:scale-110 duration-500 transition-transform">payments</span>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden group text-rose-700">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter text-rose-400">مدفوعات خارجية (صرف)</p>
            <h3 className="text-3xl font-black mt-1">{(movements || []).reduce((sum:number, m:any) => sum+parseFloat(m.expense_amount),0).toLocaleString()} <span className="text-xs">₪</span></h3>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-rose-500/5 group-hover:scale-110 duration-500 transition-transform">account_balance_wallet</span>
         </div>
      </div>
    </div>
  );
}
