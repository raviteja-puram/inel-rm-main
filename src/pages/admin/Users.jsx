import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopbar from '../../components/AdminTopbar';
import { deleteUser, getCurrentUser, getUsers, saveUser } from '../../services/session';
import { ROLE_LABELS } from '../../services/permissions';

const blankUser = { username: '', name: '', password: '', role: 'analyst' };

function Users() {
  const user = getCurrentUser();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blankUser);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const counts = useMemo(() => users.reduce((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {}), [users]);

  function reload() {
    setUsers(getUsers());
  }

  useEffect(() => {
    reload();
  }, []);

  function resetForm() {
    setForm(blankUser);
    setEditing(null);
    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    try {
      saveUser(form);
      resetForm();
      reload();
    } catch (err) {
      setError(err.message || 'Unable to save user');
    }
  }

  function startEdit(item) {
    setEditing(item.username);
    setForm({ ...item });
    setError('');
  }

  function remove(username) {
    if (username === 'admin') {
      setError('Default admin cannot be deleted in demo mode');
      return;
    }
    if (!window.confirm(`Delete user ${username}?`)) return;
    deleteUser(username);
    reload();
  }

  return (
    <div className="erp-admin flex min-h-screen">
      <AdminSidebar active="users" user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar
          title="Users"
          description="Create demo users and control access by role"
          user={user}
          actions={<button onClick={resetForm} className="erp-secondary-action">New User</button>}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
            <section className="rounded-[28px] border border-[#eceafa] bg-white p-6 shadow-[0_24px_70px_rgba(109,61,245,0.08)]">
              <h2 className="text-lg font-bold text-[#161326]">{editing ? 'Edit user' : 'Create user'}</h2>
              <p className="mt-1 text-sm text-[#8a849b]">This demo stores users in the browser. No Google login is required.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#aaa5b8]">
                  Name
                  <input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 block w-full rounded-2xl border border-[#eceafa] px-4 py-3" placeholder="Display name" />
                </label>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#aaa5b8]">
                  Username
                  <input value={form.username} readOnly={!!editing} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} className="mt-2 block w-full rounded-2xl border border-[#eceafa] px-4 py-3" placeholder="username" />
                </label>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#aaa5b8]">
                  Password
                  <input value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} className="mt-2 block w-full rounded-2xl border border-[#eceafa] px-4 py-3" placeholder="password" />
                </label>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#aaa5b8]">
                  Role
                  <select value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))} className="mt-2 block w-full rounded-2xl border border-[#eceafa] px-4 py-3">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

                <button type="submit" className="erp-primary-action w-full">{editing ? 'Update User' : 'Create User'}</button>
              </form>
            </section>

            <section className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <div key={role} className="rounded-[26px] border border-[#eceafa] bg-white p-5 shadow-[0_20px_60px_rgba(109,61,245,0.07)]">
                    <div className="text-xs font-bold uppercase tracking-[0.06em] text-[#aaa5b8]">{label}</div>
                    <div className="mt-3 text-3xl font-black text-[#161326]">{counts[role] || 0}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[#eceafa] bg-white shadow-[0_24px_70px_rgba(109,61,245,0.08)]">
                <div className="border-b border-[#f0eef9] px-6 py-5">
                  <h2 className="text-lg font-bold text-[#161326]">User access</h2>
                  <p className="mt-1 text-sm text-[#8a849b]">Admin can manage everything. Planner handles stock and BOM. Analyst views dashboard and reports.</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      {['User', 'Role', 'Access', 'Actions'].map((h) => <th key={h} className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.06em]">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.username} className="border-t border-[#f1effa]">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#161326]">{item.name || item.username}</div>
                          <div className="text-sm text-[#8a849b]">{item.username}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#f4f1ff] px-3 py-1 text-xs font-bold text-[#6d3df5]">{ROLE_LABELS[item.role]}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#5f5a70]">
                          {item.role === 'admin' && 'All modules, reset data, manage users'}
                          {item.role === 'planner' && 'Dashboard, BOM, upload stock; no history'}
                          {item.role === 'analyst' && 'Dashboard trends and reports only'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(item)} className="rounded-full border border-[#eceafa] px-3 py-1.5 text-xs font-bold text-[#6d3df5]">Edit</button>
                            <button onClick={() => remove(item.username)} className="rounded-full border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Users;
