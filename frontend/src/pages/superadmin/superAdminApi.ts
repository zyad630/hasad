import { api } from '../../api/baseApi';

export const superAdminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOverview: build.query({
      query: () => 'superadmin/overview/',
      providesTags: ['SuperAdmin'],
    }),
    getTenants: build.query({
      query: () => 'superadmin/tenants/',
      providesTags: ['SuperAdmin'],
    }),
    getTenantActivity: build.query({
      query: (id) => `superadmin/tenants/${id}/activity/`,
      providesTags: ['SuperAdmin'],
    }),
    getAuditLogs: build.query({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.tenant) queryParams.append('tenant', params.tenant);
        if (params?.action) queryParams.append('action', params.action);
        return `superadmin/audit-log/?${queryParams.toString()}`;
      },
      providesTags: ['SuperAdmin'],
    }),
  }),
});

export const {
  useGetOverviewQuery,
  useGetTenantsQuery,
  useGetTenantActivityQuery,
  useGetAuditLogsQuery,
} = superAdminApi;
