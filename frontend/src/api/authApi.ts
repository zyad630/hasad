import { api } from './baseApi'

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: 'auth/login/',
        method: 'POST',
        body: credentials,
      }),
    }),
    me: builder.query({
      query: () => 'auth/me/',
    }),
  }),
})

export const { useLoginMutation, useMeQuery } = authApi
