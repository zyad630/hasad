import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const DashboardLayout = () => {
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-screen font-cairo selection:bg-primary/20" dir="rtl">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen bg-background md:me-64 relative overflow-x-auto">
        <Header />
        <div className="p-4 md:p-8 w-full min-w-0 mx-auto pb-24 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
