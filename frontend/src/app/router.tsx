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
import CustomersList from '../pages/suppliers/Customers';
import CurrenciesPage from '../pages/settings/Currencies';
import DailyMovements from '../pages/market/DailyMovements';
import CustomerBalanceReport from '../pages/reports/CustomerBalanceReport';
import SupplierStatement from '../pages/suppliers/SupplierStatement';
import ChecksPage from '../pages/finance/ChecksPage';
import PayrollPage from '../pages/hr/Payroll';
import OrdersList from '../pages/orders/OrdersList';
import ReturnsList from '../pages/returns/ReturnsList';


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
        path: 'market/floor',
        element: <DailyMovements />,
      },
      {
        path: 'suppliers',
        element: <SuppliersList />,
      },
      {
        path: 'suppliers/:id/statement',
        element: <SupplierStatement />,
      },
      {
        path: 'customers',
        element: <CustomersList />,
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
      {
        path: 'finance/checks',
        element: <ChecksPage />,
      },
      {
        path: 'reports/customer-balances',
        element: <CustomerBalanceReport />,
      },
      {
        path: 'currencies',
        element: <CurrenciesPage />,
      },
      {
        path: 'hr/payroll',
        element: <PayrollPage />,
      },
      {
        path: 'orders',
        element: <OrdersList />,
      },
      {
        path: 'returns',
        element: <ReturnsList />,
      },
      {
        path: 'super-admin',
        element: <SuperAdminDashboard />,
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
