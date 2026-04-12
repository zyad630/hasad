import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials } from '../store/authSlice';
import { api } from '../api/baseApi';
import { Leaf, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (credentials) => ({
        url: 'auth/login/',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

const { useLoginMutation } = authApi;

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login({ username, password }).unwrap();
      dispatch(setCredentials({
        user: data.user,
        token: data.access
      }));
      navigate('/');
    } catch (err: any) {
      setError(err.data?.detail || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f2419] flex items-center justify-center p-6 relative overflow-hidden font-arabic" dir="rtl">
      
      {/* ──── Advanced Neon Veggie Grid ──── */}
      <div className="absolute inset-0 z-0 pointer-events-none grid grid-cols-6 gap-20 py-20 pr-10 overflow-hidden">
         {[...Array(30)].map((_, i) => {
            const veggies = [
              { icon: '🍅', color: 'red' },
              { icon: '🥦', color: 'green' },
              { icon: '🥕', color: 'orange' },
              { icon: '🍆', color: 'purple' },
              { icon: '🍋', color: 'yellow' },
              { icon: '🍇', color: 'indigo' }
            ];
            const item = veggies[i % veggies.length];
            return (
              <div 
                key={i} 
                className={`text-6xl veggie-neon-pulse veggie-glow-${item.color} flex items-center justify-center`}
                style={{
                  animationDelay: `${(i % 5) * 1.2 + (Math.floor(i/6) * 0.8)}s`,
                  animationDuration: `3s`
                }}
              >
                {item.icon}
              </div>
            );
         })}
      </div>

      <div className="max-w-[450px] w-full relative z-10 animate-fade-in group">
        
        {/* Branding Area */}
        <div className="text-center mb-10">
           <div className="w-24 h-24 bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_8px_40px_rgba(5,150,82,0.6)] border-4 border-white/10 animate-glow mb-6 rotate-6 group-hover:rotate-0 transition-transform duration-500">
              <Leaf size={48} className="text-white" />
           </div>
           <h1 className="text-5xl font-black text-white logo-font tracking-tighter mb-2">حـصـاد</h1>
           <p className="text-emerald-400/60 font-bold uppercase tracking-[0.3em] text-xs">Premium SaaS Platform</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/95 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/20">
           <div className="mb-8 border-b border-slate-100 pb-6 text-center">
              <h2 className="text-2xl font-black text-slate-800">مرحبـاً بعـودتك</h2>
              <p className="text-slate-400 font-bold text-sm mt-1">سجل الدخول لإدارة الحركات اليومية والذمم</p>
           </div>

           {error && (
             <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 animate-shake">
                <AlertCircle size={20} />
                <p className="font-bold text-xs">{error}</p>
             </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">اسم المستخدم</label>
                 <div className="relative group">
                    <User size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                    <input 
                       required 
                       type="text" 
                       value={username} 
                       onChange={e => setUsername(e.target.value)}
                       className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 font-bold text-slate-700 outline-none focus:border-emerald-600 focus:bg-white transition-all text-lg" 
                       placeholder="admin_hassad"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">رقم المرور السري</label>
                 <div className="relative group">
                    <Lock size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                    <input 
                       required 
                       type="password" 
                       value={password} 
                       onChange={e => setPassword(e.target.value)}
                       className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 font-bold text-slate-700 outline-none focus:border-emerald-600 focus:bg-white transition-all text-lg" 
                       placeholder="**********"
                    />
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-18 bg-[#059652] text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-10 border-b-4 border-emerald-900"
              >
                 {isLoading ? <Loader2 className="animate-spin" /> : null}
                 {isLoading ? 'جاري التحقق...' : 'تـسـجيل الدخول'}
              </button>
           </form>

           <div className="mt-8 text-center">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Hassad Cloud Infrastructure v3.1</p>
           </div>
        </div>

        {/* Footer Support Banner */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-30 group-hover:opacity-100 transition-opacity duration-700 grayscale hover:grayscale-0">
           <img src="https://img.icons8.com/color/48/visa.png" alt="Visa" className="h-6" />
           <img src="https://img.icons8.com/color/48/mastercard.png" alt="Mastercard" className="h-6" />
           <img src="https://img.icons8.com/color/48/paypal_1.png" alt="Paypal" className="h-6" />
        </div>

      </div>
    </div>
  );
}
