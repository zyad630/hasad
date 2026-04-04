import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../store'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: 'https://hasad-backend.onrender.com/api/',
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
    // If token is expired or invalid, auto logout to redirect to login page
    api.dispatch(logout());
  }
  
  if (result.data && typeof result.data === 'object' && 'results' in result.data) {
    // Extract DRF paginated 'results' automatically to prevent .map crashes
    result.data = (result.data as any).results;
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: customBaseQuery,
  tagTypes: ['Shipments', 'Suppliers', 'Customers', 'Containers', 'Expenses', 'Sales', 'Settlements', 'Cash', 'Items', 'Tenants', 'SuperAdmin'],
  endpoints: () => ({}),
});
