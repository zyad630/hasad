import { NavLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';

const navItems = [
  { path: '/dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
  { path: '/shipments', label: 'الإرساليات', icon: 'inventory_2' },
  { path: '/sales', label: 'البيع السريع', icon: 'point_of_sale' },
  { path: '/suppliers', label: 'الموردين', icon: 'person_apron' },
  { path: '/inventory', label: 'الأصناف والفوارغ', icon: 'package_2' },
  { path: '/finance', label: 'التصفية', icon: 'rebase_edit' },
  { path: '/expenses', label: 'المصاريف', icon: 'payments' },
  { path: '/reports', label: 'التقارير', icon: 'analytics' },
  { path: '/settings', label: 'الإعدادات', icon: 'settings' },
];

const Sidebar = () => {
  const dispatch = useDispatch();

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 sticky top-0 bg-zinc-50/80 backdrop-blur-md py-6 font-cairo font-medium z-50 border-l border-zinc-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="px-6 mb-8">
        <h1 className="text-xl font-black text-emerald-900">إدارة الحِسبة</h1>
        <p className="text-xs text-zinc-500 mt-1">النسخة الإحترافية</p>
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
