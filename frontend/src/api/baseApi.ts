import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../store'

const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultBaseUrl = isDevelopment ? 'http://localhost:8000/api/' : 'https://your-backend-url.onrender.com/api/';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
});

import { logout } from '../store/authSlice';

const customBaseQuery = async (args: any, api: any, extraOptions: any) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  
  if (result.error && result.error.status === 401) {
    api.dispatch(logout());
  }
  
  // Robust check for DRF pagination
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    const dataObj = result.data as any;
    if ('results' in dataObj && Array.isArray(dataObj.results)) {
       result.data = dataObj.results;
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: customBaseQuery,
  tagTypes: ['Shipments', 'Suppliers', 'Customers', 'Containers', 'Expenses', 'Sales', 'Settlements', 'Cash', 'Items', 'Tenants', 'SuperAdmin', 'Currencies', 'Movements', 'AccountGroups', 'ExchangeRates', 'Accounts', 'Categories', 'CommissionTypes', 'Receivables', 'Users', 'GlobalUnits', 'Employees'],
  endpoints: (build) => ({
    sendWhatsAppAlert: build.mutation({
      query: (body) => ({
        url: 'integrations/whatsapp/send/',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useSendWhatsAppAlertMutation } = api as any;
