import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';

export const ProtectedLayout = () => {
    const dispatch = useDispatch();
    const location = useLocation();
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
        localStorage.clear();
        window.location.href = '/login';
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    const getNavClass = (path: string, exact: boolean = false, isDanger: boolean = false, isAi: boolean = false) => {
        const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
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
                    <div className="nav-section-label">الرئيسية</div>
                    <Link to="/dashboard" className={getNavClass('/dashboard', true)}>
                        <i className="fa-solid fa-chart-pie"></i><span>لوحة التحكم (الأساسات)</span>
                    </Link>
                    <Link to="/settings/control-panel" className={getNavClass('/settings/control-panel')}>
                        <i className="fa-solid fa-gears"></i><span>الإعدادات المتقدمة</span>
                    </Link>

                    <div className="nav-section-label">العمليات</div>
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
                        <i className="fa-solid fa-receipt"></i><span>الطلبات السابقة (الفواتير)</span>
                    </Link>

                    <div className="nav-section-label">المحاسبة والعملاء</div>
                    <Link to="/suppliers" className={getNavClass('/suppliers')}>
                        <i className="fa-solid fa-users"></i><span>العملاء والمزارعين</span>
                    </Link>
                    <Link to="/customers" className={getNavClass('/customers')}>
                        <i className="fa-solid fa-user-tag"></i><span>تجار وزبائن</span>
                    </Link>
                    <Link to="/finance/cash" className={getNavClass('/finance')}>
                        <i className="fa-solid fa-file-invoice-dollar"></i><span>السندات والمالية</span>
                    </Link>
                    <Link to="/reports/receivables" className={getNavClass('/reports/receivables')}>
                        <i className="fa-solid fa-wallet"></i><span>دفتر الذمم (الأرصدة)</span>
                    </Link>

                    <div className="nav-section-label">المخزون والجرد</div>
                    <Link to="/finance/containers" className={getNavClass('/finance/containers')}>
                        <i className="fa-solid fa-box-open"></i><span>أرصدة الفوارغ</span>
                    </Link>
                    <Link to="/inventory" className={getNavClass('/inventory')}>
                        <i className="fa-solid fa-boxes-stacked"></i><span>المخزون والجرد</span>
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
                            <input type="text" id="global-search" placeholder="بحث سريع..." />
                        </div>
                        <span className="today-date" id="today-date">
                            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
