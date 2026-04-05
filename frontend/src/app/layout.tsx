import { Outlet, Navigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';
import { LogOut, Home, Users, Package, Truck, UserCircle, ShoppingCart, Calculator, Wallet } from 'lucide-react';

export const ProtectedLayout = () => {
    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-arabic" dir="rtl">
            {/* Premium Glass Sidebar */}
            <aside className="w-64 glass flex flex-col m-4 shadow-xl animate-fade-in" style={{ height: 'calc(100vh - 2rem)', position: 'sticky', top: '1rem' }}>
                <div className="flex flex-col items-center justify-center p-6 border-b border-emerald-50/50 mb-4 bg-gradient-to-b from-emerald-50/50 to-transparent rounded-t-2xl">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-700 tracking-tighter">نظام حَصاد</h1>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/50 px-3 py-1 rounded-full mt-2 uppercase tracking-widest">
                        SaaS Platform PRO
                    </span>
                </div>
                
                <nav className="flex-1 space-y-1.5 px-3 overflow-y-auto">
                    <NavItem to="/dashboard" icon={<Home size={18} />} label="لوحة التحكم" />
                    <NavItem to="/pos" icon={<ShoppingCart size={18} />} label="نقطة البيع (POS)" />
                    <NavItem to="/suppliers" icon={<Users size={18} />} label="الموردين" />
                    <NavItem to="/inventory" icon={<Package size={18} />} label="الأصناف" />
                    <NavItem to="/shipments" icon={<Truck size={18} />} label="الإرساليات" />
                    
                    <div style={{ marginTop: '2rem', marginBottom: '0.75rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', opacity: 0.8 }}>الحسابات</div>
                    
                    <NavItem to="/finance/cash" icon={<Wallet size={18} />} label="الخزينة" />
                    <NavItem to="/finance/expenses" icon={<Truck size={18} />} label="المصروفات" />
                    <NavItem to="/finance/containers" icon={<Package size={18} />} label="الفوارغ" />
                    <NavItem to="/finance/settlements" icon={<Calculator size={18} />} label="التصفيات" />
                </nav>

                <div className="p-4 border-t border-slate-100/50">
                    <button 
                        onClick={() => dispatch(logout())} 
                        className="w-full flex justify-start items-center p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-300 gap-2"
                    >
                        <LogOut size={18} />
                        تسجيل الخروج
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen">
                <header className="h-20 glass m-4 mb-0 flex items-center justify-between px-8 shadow-md sticky top-4 z-10">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-secondary text-sm px-3 py-1.5 h-auto">الإشعارات</button>
                        <div className="p-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                            <UserCircle size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800">أهلاً بك، {user?.username}</div>
                            <div className="text-xs text-emerald-600 font-bold mt-0.5">مدير النظام</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-x-hidden">
                    <div className="min-h-full animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
    <Link 
        to={to} 
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm hover:scale-[1.02] transition-all duration-300 font-medium"
    >
        {icon}
        <span className="font-bold text-sm">{label}</span>
    </Link>
);
