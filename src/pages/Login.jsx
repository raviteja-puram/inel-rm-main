import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/inel-logo.svg';
import { getUsers, setCurrentUser } from '../services/session';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleLogin(e) {
    e?.preventDefault();
    const found = getUsers().find(
      (u) => u.username === username.trim().toLowerCase() && u.password === password,
    );
    if (found) {
      setCurrentUser(found);
      navigate('/admin');
    } else {
      setError('Wrong username or password!');
    }
  }

  return (
    <div
      className="login-dark"
      style={{ fontFamily: '"DM Sans", "Nunito Sans", Montserrat, "Open Sans", Ubuntu, Quicksand, "Segoe UI", sans-serif' }}
    >
      <div className="pointer-events-none fixed -left-24 top-16 h-72 w-72 rounded-full bg-[#d8d1ff] blur-3xl" />
      <div className="pointer-events-none fixed -right-20 bottom-10 h-80 w-80 rounded-full bg-[#eadcff] blur-3xl" />

      <main className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_430px]">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#eceafa] bg-white px-4 py-2 text-sm font-bold text-[#6d3df5] shadow-[0_16px_40px_rgba(109,61,245,0.08)]">
            Unit 2 material planning
          </div>
          <h1 className="max-w-xl text-6xl font-black leading-[1.02] tracking-normal text-[#08051d]">
            Raw material control, ready for production.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#8a849b]">
            Track components, FG demand, stock coverage, shortage risk, and confirmed production from one clean workspace.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
            {['Components', 'FG plans', 'Stock flow'].map((item) => (
              <div key={item} className="rounded-[24px] border border-[#eceafa] bg-white p-5 shadow-[0_20px_50px_rgba(109,61,245,0.08)]">
                <div className="mb-4 h-10 w-10 rounded-2xl bg-[#f4f1ff]" />
                <div className="text-sm font-black">{item}</div>
                <div className="mt-1 text-xs text-[#8a849b]">Live module</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-[#eceafa] bg-white p-8 shadow-[0_30px_80px_rgba(109,61,245,0.12)]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#6d3df5] to-[#8f22e8] shadow-[0_24px_50px_rgba(109,61,245,0.26)]">
              <img src={logo} alt="INEL" className="h-10 brightness-0 invert" />
            </div>
            <h2 className="text-2xl font-black text-[#08051d]">INEL RM</h2>
            <p className="mt-2 text-sm text-[#8a849b]">Authorized access only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#aaa5b8]">
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-[#eceafa] bg-[#fbfaff] px-4 py-3.5 text-sm font-semibold text-[#161326] outline-none transition focus:border-[#b7a9ff] focus:bg-white focus:ring-4 focus:ring-[#6d3df5]/10"
                placeholder="Enter your username"
              />
            </label>

            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#aaa5b8]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-[#eceafa] bg-[#fbfaff] px-4 py-3.5 text-sm font-semibold text-[#161326] outline-none transition focus:border-[#b7a9ff] focus:bg-white focus:ring-4 focus:ring-[#6d3df5]/10"
                placeholder="Enter your password"
              />
            </label>

            {error && (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-600">{error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-[#6d3df5] to-[#8f22e8] py-3.5 text-sm font-black text-white shadow-[0_22px_42px_rgba(109,61,245,0.24)] transition hover:brightness-95"
            >
              Login
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-semibold text-[#aaa5b8]">
            INEL - Unit 2 - Material Planning
          </p>
        </section>
      </main>
    </div>
  );
}

export default Login;
