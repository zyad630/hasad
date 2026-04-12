import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';
import { formatDateDisplay } from '../utils/dateUtils';

export const ProtectedLayout = () => {
    const dispatch = useDispatch();
    const location = useLocation();
    const [receivablesOpen, setReceivablesOpen] = React.useState(location.pathname.startsWith('/reports/receivables'));
    const [accountsOpen, setAccountsOpen] = React.useState(false);
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
        localStorage.clear();
        window.location.href = '/login';
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    const getNavClass = (path: string, exact: boolean = false, isDanger: boolean = false, isAi: boolean = false) => {
        const [targetPath, targetSearch] = path.split('?');
        const isPathActive = exact ? location.pathname === targetPath : location.pathname.startsWith(targetPath);
        const isSearchActive = !targetSearch || location.search.includes(targetSearch);
        const isActive = isPathActive && isSearchActive;
        
        let baseClass = 'nav-item';
        if (isDanger) baseClass += ' nav-danger';
        if (isAi) baseClass += ' nav-ai';
        if (isActive) baseClass += ' active';
        return baseClass;
    };

    return (
        <div className="app-container" id="app-shell">
            {/* ── SIDEBAR ── */}
            <aside className="sidebar" id="sidebar">
                <div className="logo-container">
                    <div className="logo-icon"><i className="fa-solid fa-leaf"></i></div>
                    <div>
                        <div className="logo-text">حَصاد</div>
                        <div className="logo-sub">إدارة محلات الخضار</div>
                    </div>
                </div>

                <nav className="sidebar-nav" id="sidebar-nav">
                    <div className="nav-section-label">الرئيسية والأساسيات</div>
                    <Link to="/dashboard" className={getNavClass('/dashboard', true)}>
                        <i className="fa-solid fa-chart-pie"></i><span>الرئيسية والتقارير</span>
                    </Link>
                    <Link to="/inventory" className={getNavClass('/inventory')}>
                        <i className="fa-solid fa-boxes-stacked"></i><span>المستودع (الأصناف)</span>
                    </Link>
                    <Link to="/settings/control-panel" className={getNavClass('/settings/control-panel')}>
                        <i className="fa-solid fa-gears"></i><span>الإعدادات المتقدمة</span>
                    </Link>

                    <div className="nav-section-label">العمليات اليومية</div>
                    <Link to="/pos" className={getNavClass('/pos')}>
                         <i className="fa-solid fa-cash-register"></i><span>نقطة البيع</span>
                    </Link>
                    <Link to="/market/floor" className={getNavClass('/market/floor')}>
                        <i className="fa-solid fa-book-open"></i><span>دفتر الحركات اليومية</span>
                    </Link>
                    <Link to="/shipments" className={getNavClass('/shipments')}>
                        <i className="fa-solid fa-truck"></i><span>الإرساليات والمزارعين</span>
                    </Link>
                    <Link to="/reports/invoices" className={getNavClass('/reports/invoices')}>
                        <i className="fa-solid fa-file-invoice"></i><span>سجل الفواتير</span>
                    </Link>
                    <Link to="/reports/audit" className={getNavClass('/reports/audit')}>
                        <i className="fa-solid fa-shield-halved"></i><span>سجل العمليات والرقابة</span>
                    </Link>

                    <div 
                        className={`nav-item dropdown-toggle`}
                        onClick={() => setAccountsOpen(!accountsOpen)}
                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className="fa-solid fa-user-plus"></i><span>فتح حسابات (إضافة)</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${accountsOpen ? 'down' : 'left'}`} style={{ fontSize: '10px' }}></i>
                    </div>

                    {accountsOpen && (
                        <div className="dropdown-menu" style={{ paddingRight: '20px', background: 'rgba(5,150,82,0.05)', borderRadius: '8px', margin: '4px 12px' }}>
                            <Link to="/customers?add=1" className={getNavClass('/customers?add=1')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-user-tag" style={{ fontSize: '11px' }}></i><span>حساب زبون</span>
                            </Link>
                            <Link to="/suppliers?add=1" className={getNavClass('/suppliers?add=1')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-tractor" style={{ fontSize: '11px' }}></i><span>إضافة مورد جديد</span>
                            </Link>
                            <Link to="/hr/payroll?add=1" className={getNavClass('/hr/payroll?add=1')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-id-badge" style={{ fontSize: '11px' }}></i><span>إضافة موظف جديد</span>
                            </Link>
                            <Link to="/partners" className={getNavClass('/partners')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-handshake" style={{ fontSize: '11px' }}></i><span>حساب مساهم / شريك</span>
                            </Link>
                        </div>
                    )}

                    <div className="nav-section-label">المحاسبة</div>
                    <Link to="/finance/cash" className={getNavClass('/finance')}>
                        <i className="fa-solid fa-file-invoice-dollar"></i><span>السندات والمالية</span>
                    </Link>
                    
                    <div 
                        className={`nav-item dropdown-toggle ${location.pathname.startsWith('/reports/receivables') ? 'active' : ''}`}
                        onClick={() => setReceivablesOpen(!receivablesOpen)}
                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className="fa-solid fa-wallet"></i><span>دفتر الذمم (الأرصدة)</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${receivablesOpen ? 'down' : 'left'}`} style={{ fontSize: '10px' }}></i>
                    </div>

                    {receivablesOpen && (
                        <div className="dropdown-menu" style={{ paddingRight: '20px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', margin: '4px 12px' }}>
                            <Link to="/reports/receivables?party=farmers" className={getNavClass('/reports/receivables?party=farmers')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-tractor" style={{ fontSize: '12px' }}></i><span>المزارعين</span>
                            </Link>
                            <Link to="/reports/receivables?party=traders" className={getNavClass('/reports/receivables?party=traders')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-store" style={{ fontSize: '12px' }}></i><span>الزبائن</span>
                            </Link>
                            <Link to="/reports/receivables?party=employees" className={getNavClass('/reports/receivables?party=employees')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-id-badge" style={{ fontSize: '12px' }}></i><span>الموظفين</span>
                            </Link>
                            <Link to="/reports/receivables?party=partners" className={getNavClass('/reports/receivables?party=partners')} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                <i className="fa-solid fa-handshake" style={{ fontSize: '12px' }}></i><span>الشريك</span>
                            </Link>
                        </div>
                    )}

                    <Link to="/finance/containers" className={getNavClass('/finance/containers')}>
                        <i className="fa-solid fa-box-open"></i><span>أرصدة الفوارغ</span>
                    </Link>

                    <div className="nav-section-label">التحليل</div>
                    <Link to="/reports/customer-balances" className={getNavClass('/reports')}>
                        <i className="fa-solid fa-chart-line"></i><span>التقارير</span>
                    </Link>
                    
                    {user?.is_staff && (
                        <Link to="/super-admin" className={getNavClass('/super-admin', false, true)}>
                            <i className="fa-solid fa-shield-halved"></i><span>إدارة المنصة (SaaS Admin)</span>
                        </Link>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar" id="user-avatar">{user?.username?.charAt(0).toUpperCase() || 'م'}</div>
                        <div style={{display:'flex', flexDirection:'column', flex:1}}>
                            <div className="user-name" id="user-name">{user?.username}</div>
                            <div className="user-role" id="user-role">{user?.tenant_name || 'مدير النظام'}</div>
                        </div>
                        <button className="logout-btn" id="logout-btn" title="تسجيل الخروج" onClick={handleLogout}>
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <button className="menu-toggle" id="menu-toggle">
                            <i className="fa-solid fa-bars"></i>
                        </button>
                        <div className="search-bar" id="global-search-wrap">
                            <i className="fa-solid fa-search"></i>
                            <input 
                                type="text" 
                                id="global-search" 
                                placeholder="بحث سريع للزبائن والمزارعين..." 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const query = (e.target as HTMLInputElement).value;
                                        if (query) {
                                            // Handle global search: search for party and navigate to statement
                                            window.location.href = `/accounting/statement?q=${encodeURIComponent(query)}`;
                                        }
                                    }
                                }}
                            />
                        </div>
                        <span className="today-date" id="today-date">
                            {formatDateDisplay(new Date())}
                        </span>
                    </div>
                    <div className="header-right">
                        <button className="header-btn" id="notif-btn" title="الإشعارات">
                            <i className="fa-regular fa-bell"></i>
                            <span className="notif-badge" id="notif-badge" style={{display:'none'}}>0</span>
                        </button>
                        <button className="header-btn btn-primary" id="quick-add-btn" title="إضافة حركة سريعة" style={{width:'auto', padding:'0 14px', borderRadius:'var(--radius-md)', fontSize:'13px', fontWeight:700, gap:'6px'}}>
                            <i className="fa-solid fa-plus"></i> جديد
                        </button>
                    </div>
                </header>

                <div className="view-section active flex-1 overflow-y-auto" style={{ padding: '26px' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
