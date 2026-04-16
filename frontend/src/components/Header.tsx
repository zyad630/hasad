import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const Header = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-6 py-4 w-full bg-white/80 backdrop-blur-xl shadow-sm font-cairo leading-relaxed border-b border-zinc-100">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-emerald-900 lg:hidden block">الحِسبة الرقمية</span>
        <div className="hidden md:flex items-center gap-6 me-4 lg:me-0">
          <a className="text-emerald-700 border-b-2 border-emerald-700 pb-1 font-bold" href="#">السوق اليوم</a>
          <a className="text-zinc-500 hover:bg-zinc-50 transition-colors px-2 rounded" href="#">النشاط العام</a>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">search</span>
          <input 
            className="bg-surface-container-low border-0 rounded-full pe-10 ps-4 py-2 focus:ring-2 focus:ring-primary w-64 text-sm outline-none transition-shadow" 
            placeholder="بحث سريع للمزارعين والأصناف..." 
            type="text"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-full relative transition-colors">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
          </button>
          
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-800 to-emerald-900 text-white font-bold overflow-hidden me-2 shadow-md">
            {user?.username?.[0]?.toUpperCase() || 'م'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
