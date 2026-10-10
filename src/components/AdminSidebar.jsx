import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearCurrentUser, setCurrentUser } from "../services/session";
import { deleteAllData } from "../services/api";
import { getPermissions } from "../services/permissions";

const icons = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  components: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.5 7.5 4 7.5-4M12 21v-9.5" />
    </>
  ),
  products: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  bom: (
    <>
      <path d="M4 21V10l4-3v3l5-4v4l7-4v15H4Z" />
      <path d="M8 21v-4h3v4M15 14h1M15 17h1" />
    </>
  ),
  stock: (
    <>
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </>
  ),
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/admin" },
  { key: "components", label: "Raw Materials", path: "/admin/components" },
  { key: "products", label: "FG Products", path: "/admin/fgproducts" },
  { key: "bom", label: "BOM / Production", path: "/admin/bommaster" },
  { key: "stock", label: "Upload Stock", path: "/admin/stock" },
  { key: "reports", label: "Reports", path: "/admin/reports" },
  { key: "email", label: "Email Management", path: "/admin/email" },
  { key: "users", label: "Users", path: "/admin/users" },
];

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {icons[name]}
    </svg>
  );
}

function AdminSidebar({ active, user }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileKey = `inel_rm_profile_${user?.username || "user"}`;
  const [profile, setProfile] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(profileKey)) || {
          name: user?.name || user?.username || "Admin",
          photo: "",
        }
      );
    } catch {
      return { name: user?.name || user?.username || "Admin", photo: "" };
    }
  });
  const permissions = getPermissions(user);
  const expanded = hovered;
  const visibleItems = NAV_ITEMS.filter((item) =>
    permissions.routes.includes(item.key),
  );

  function handleLogout() {
    clearCurrentUser();
    navigate("/");
  }

  function saveProfile(next) {
    setProfile(next);
    localStorage.setItem(profileKey, JSON.stringify(next));
    setCurrentUser({ ...user, name: next.name });
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => saveProfile({ ...profile, photo: reader.result });
    reader.readAsDataURL(file);
  }

  async function handleDeleteAllData() {
    if (!permissions.canResetData) return;
    if (resetting || !window.confirm("Delete all uploaded ERP data?")) return;
    if (!window.confirm("Final confirmation: this cannot be undone. Continue?"))
      return;
    try {
      setResetting(true);
      await deleteAllData();
      window.location.reload();
    } catch (error) {
      window.alert(error.message || "Delete failed");
      setResetting(false);
    }
  }

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="admin-sidebar sticky top-0 h-screen w-[100px] flex-shrink-0 bg-[#08070d] p-3 lg:p-4 text-white"
    >
      <div className="top-profile">
        <button
          onClick={() => setProfileOpen((value) => !value)}
          className="top-profile-button"
        >
          {profile.photo ? (
            <img src={profile.photo} alt="Profile" />
          ) : (
            <span>{profile.name.slice(0, 2).toUpperCase()}</span>
          )}
          <span>
            <strong>{profile.name}</strong>
            <small>{user?.role}</small>
          </span>
          <b>⌄</b>
        </button>
        {profileOpen && (
          <div className="top-profile-menu">
            <div className="top-profile-card">
              {profile.photo ? (
                <img src={profile.photo} alt="Profile" />
              ) : (
                <span>{profile.name.slice(0, 2).toUpperCase()}</span>
              )}
              <div>
                <strong>{profile.name}</strong>
                <small>@{user?.username}</small>
              </div>
            </div>
            <label>
              Change picture
              <input
                type="file"
                accept="image/*"
                onChange={choosePhoto}
                hidden
              />
            </label>
            <button
              onClick={() => {
                const name = window
                  .prompt("Enter profile name", profile.name)
                  ?.trim();
                if (name) saveProfile({ ...profile, name });
              }}
            >
              Edit name
            </button>
            {profile.photo && (
              <button onClick={() => saveProfile({ ...profile, photo: "" })}>
                Remove picture
              </button>
            )}
            <button className="profile-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
      <div
        className={`${expanded ? "sidebar-panel-expanded" : ""} sidebar-panel flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#14121d] shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur`}
      >
        <div className="flex h-[82px] shrink-0 items-center px-5">
          <div className="sidebar-brand-logo flex h-12 w-12 items-center justify-center rounded-[18px] bg-white p-1.5 shadow-[0_18px_36px_rgba(124,92,255,0.28)]">
            <img
              src="/inel-logo-mini.png"
              alt="INEL logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="sidebar-brand-copy ml-3">
            <div className="font-bold tracking-normal text-white">INEL RM</div>
            <div className="text-[12px] font-medium text-[#8e889d]">
              Material Planning
            </div>
          </div>
        </div>

        <nav className="sidebar-nav min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {visibleItems.map((item) => {
            const selected = item.key === active;
            return (
              <button
                key={item.key}
                title={item.label}
                onClick={() => !selected && navigate(item.path)}
                className={`${selected ? "sidebar-nav-item-active bg-gradient-to-r from-[#7c5cff] to-[#a020f0] text-white shadow-[0_16px_32px_rgba(124,92,255,0.28)]" : "sidebar-nav-item-inactive text-[#8e889d]"} ${expanded ? "" : "justify-center"} sidebar-nav-item flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-semibold transition`}
              >
                <Icon name={item.key} />
                {expanded && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          {expanded && permissions.canResetData && (
            <button
              onClick={handleDeleteAllData}
              disabled={resetting}
              className="mt-3 w-full text-[11px] font-semibold text-[#777183] hover:text-red-400"
            >
              Reset uploaded data
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
