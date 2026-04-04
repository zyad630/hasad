import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';
import { Sprout, User, Lock, AlertCircle, ArrowLeft, Leaf } from 'lucide-react';
import { InlineDotsLoader } from '../components/Skeleton';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login({ username, password }).unwrap();
      dispatch(setCredentials({ user: user.user, token: user.access }));
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden font-arabic" dir="rtl">
      {/* Agricultural Beautiful Background Orbs */}
      <div className="absolute top-0 -right-64 w-[600px] h-[600px] bg-emerald-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob"></div>
      <div className="absolute top-0 -left-64 w-[600px] h-[600px] bg-lime-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-400/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-blob animation-delay-4000"></div>

      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] z-0"></div>

      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in shadow-2xl rounded-3xl bg-white border border-emerald-50">
        <div className="p-10">
          
          {/* Logo Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl mb-6 shadow-[0_10px_30px_rgba(16,185,129,0.3)] transform transition hover:scale-105">
              <Sprout size={48} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight flex items-center justify-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-600 to-green-500">حـصـاد</span>
            </h1>
            <p className="text-zinc-500 mt-2 font-bold text-lg">المنصة الأذكى عالمياً لإدارة أسواق الخضار والحسبة</p>
          </div>

          {/* Form Section */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 text-sm font-bold animate-fade-in shadow-sm">
              <AlertCircle size={20} className="shrink-0" />
              <span>إسم المستخدم أو كلمة المرور غير صحيحة، تأكد من البيانات.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 block text-right">أدخل إسم الدخول (اليوزر)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pe-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-500 transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  className="w-full bg-zinc-50 border-2 border-zinc-200 text-zinc-900 rounded-xl py-3.5 pe-12 ps-4 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-left"
                  placeholder="admin"
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 block text-right">كلمة المرور الخاصة بك</label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pe-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  className="w-full bg-zinc-50 border-2 border-zinc-200 text-zinc-900 rounded-xl py-3.5 pe-12 ps-4 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-left"
                  placeholder="••••••••"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.35)] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-8 border-b-4 border-emerald-700 hover:border-emerald-600"
            >
              {isLoading ? (
                <InlineDotsLoader />
              ) : (
                <>
                  <span>تسجيل الدخول للنظام</span>
                  <ArrowLeft size={20} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-emerald-50 py-4 px-10 rounded-b-3xl text-center border-t border-emerald-100 flex items-center justify-center gap-2">
          <Leaf size={16} className="text-emerald-600" />
          <p className="text-emerald-800 text-sm font-bold">بُني خصيصاً ليناسب تجار وكبار موردي الأسواق والجمعيات</p>
        </div>
      </div>

    </div>
  );
};

export default Login;
