import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedLayout } from './layout';
import POSPage from '../pages/POS/POSPage';
import Shipments from '../pages/shipments/Shipments';
import SuppliersList from '../pages/suppliers/Suppliers';
import ContainersPage from '../pages/finance/ContainersPage';
import ExpensesPage from '../pages/finance/ExpensesPage';
import SettlementPage from '../pages/finance/SettlementPage';
import CashPage from '../pages/finance/CashPage';
import Dashboard from '../pages/Dashboard';
import Inventory from '../pages/inventory/Inventory';
import LoginPage from '../pages/Login';
import SuperAdminDashboard from '../pages/superadmin/SuperAdminDashboard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'suppliers',
        element: <SuppliersList />,
      },
      {
        path: 'inventory',
        element: <Inventory />,
      },
      {
        path: 'shipments',
        element: <Shipments />,
      },
      {
        path: 'pos',
        element: <POSPage />,
      },
      {
        path: 'finance/containers',
        element: <ContainersPage />,
      },
      {
        path: 'finance/expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'finance/settlements',
        element: <SettlementPage />,
      },
      {
        path: 'finance/cash',
        element: <CashPage />,
      },
    ],
  },
  {
    path: '/superadmin',
    element: <SuperAdminDashboard />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
