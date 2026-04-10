import { NavLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';

const navItems = [
  { path: '/dashboard', label: 'الرئيسية', icon: 'dashboard' },
  { path: '/market/floor', label: 'ساحة الحركات', icon: 'analytics' },
  { path: '/shipments', label: 'الإرساليات (مشتريات)', icon: 'inventory_2' },
  { path: '/pos', label: 'المبيعات السريعة (POS)', icon: 'point_of_sale' },
  { path: '/reports/invoices', label: 'سجل الفواتير', icon: 'receipt_long' },
  { path: '/suppliers', label: 'المزارعين', icon: 'person_apron' },
  { path: '/customers', label: 'الزبائن والتجار', icon: 'groups' },
  { path: '/finance/settlements', label: 'التصفيات (للمزارع)', icon: 'done_all' },
  { path: '/reports/receivables', label: 'الذمم المالية', icon: 'account_balance_wallet' },
  { path: '/finance/expenses', label: 'المصاريف', icon: 'payments' },
  { path: '/inventory', label: 'الأصناف والفوارغ', icon: 'package_2' },
  { path: '/settings/control-panel', label: 'الإعدادات المتقدمة', icon: 'settings' },
];

const Sidebar = () => {
  const dispatch = useDispatch();

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 sticky top-0 bg-zinc-50/80 backdrop-blur-md py-6 font-cairo font-medium z-50 border-l border-zinc-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
             <span className="material-symbols-outlined text-white">sprout</span>
          </div>
          <h1 className="text-2xl font-black text-emerald-900 tracking-tighter">حَصاد</h1>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mt-2 bg-emerald-50 inline-block px-2 py-0.5 rounded-md">SAAS PLATFORM PRO</p>
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto w-full custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              isActive 
                ? "flex items-center gap-3 px-4 py-3 bg-emerald-900 text-white rounded-xl mx-3 shadow-lg shadow-emerald-900/20 scale-[1.02] duration-300"
                : "flex items-center gap-3 px-4 py-3 mx-3 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors rounded-xl"
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="px-4 mt-auto pt-4 border-t border-zinc-200">
        <button 
          onClick={() => dispatch(logout())}
          className="w-full py-3 text-red-600 hover:bg-red-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
          <span className="material-symbols-outlined">logout</span>
          <span>تسجيل خروج</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
