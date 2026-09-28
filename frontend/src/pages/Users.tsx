import { useEffect, useState } from "react";
import api from "../services/api";
import { ShieldCheck, UserCheck, Users as UsersIcon, Check, Key } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
}

const ROLE_DEFINITIONS = [
  {
    role: "admin",
    title: "Store Administrator",
    badge: "Full Access",
    color: "from-purple-600 to-indigo-600",
    bg: "bg-purple-50 border-purple-200 text-purple-900",
    icon: ShieldCheck,
    permissions: [
      "User role management & security control",
      "Full catalog creation, editing & deletion",
      "3D planogram execution & showroom coordinates",
      "AI Copilot executive business strategy",
    ],
  },
  {
    role: "manager",
    title: "Store Floor Manager",
    badge: "Operations Access",
    color: "from-amber-600 to-orange-600",
    bg: "bg-amber-50 border-amber-200 text-amber-900",
    icon: UserCheck,
    permissions: [
      "Inventory restocking & stock buffer adjustments",
      "Product price updates & new SKU creation",
      "Sales velocity tracking & merchandising drawer",
      "Restricted: Cannot delete products or manage users",
    ],
  },
  {
    role: "staff",
    title: "Frontline Cashier / Associate",
    badge: "POS Access Only",
    color: "from-emerald-600 to-teal-600",
    bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
    icon: UsersIcon,
    permissions: [
      "Quick Sale POS checkout & transaction logging",
      "Real-time showroom inventory stock lookup",
      "Restricted: Cannot edit prices or delete items",
      "Restricted: Hidden from User Management tab",
    ],
  },
];

const Users = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const { showToast } = useToast();

  const load = async () => {
    try {
      const { data } = await api.get<UserRow[]>("/users");
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (id: string, newRole: string, userName: string) => {
    try {
      await api.put(`/users/${id}/role`, { role: newRole });
      showToast(`Updated ${userName}'s permission role to "${newRole.toUpperCase()}"`, "success", "Role Reassigned");
      load();
    } catch (err: any) {
      showToast("Failed to update user role", "error");
    }
  };

  return (
    <div className="px-8 pb-10 space-y-6">
      <div>
        <h2 className="text-lg font-black text-stone-900">User Access & Team Roles (RBAC)</h2>
        <p className="text-xs text-stone-500">
          Enterprise Role-Based Access Control ensuring secure separation between Store Owners, Floor Managers, and Cashiers
        </p>
      </div>

      {/* 3 Role Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLE_DEFINITIONS.map((def) => {
          const Icon = def.icon;
          return (
            <div key={def.role} className={`card p-4 border rounded-2xl ${def.bg} space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${def.color} text-white flex items-center justify-center shadow-md`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs">{def.title}</h4>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-75">
                      role: {def.role}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/80 border border-current shadow-xs">
                  {def.badge}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-current/15">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 block">Key Permissions:</span>
                <ul className="space-y-1 text-[11px] leading-snug">
                  {def.permissions.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 opacity-90">
                      <Check className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Member Role Management Table */}
      <div className="card bg-white border border-[#E5D7BE] shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5D7BE]">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Store Personnel Access Roster</h3>
            <p className="text-[11px] text-stone-500">
              Select any employee's role dropdown to instantly promote or reassign their store system privileges.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 bg-[#FAF5EE] px-3 py-1.5 rounded-xl border border-[#E5D7BE]">
            <Key className="w-3.5 h-3.5 text-orange-600" />
            <span>{users.length} Active System Users</span>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-stone-600 bg-[#F8F2E6] border-b border-[#E5D7BE] uppercase tracking-wider font-bold">
              <th className="py-3 px-4">Employee Name</th>
              <th className="py-3 px-4">Work Email</th>
              <th className="py-3 px-4">Assigned Role Tier</th>
              <th className="py-3 px-4">Access Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE5D3]">
            {users.map((u) => (
              <tr key={u._id} className="hover:bg-[#FAF5EE] transition-colors">
                <td className="py-3.5 px-4 font-bold text-stone-900 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-black text-[10px] flex items-center justify-center">
                    {u.name.slice(0, 1)}
                  </div>
                  <span>{u.name}</span>
                </td>
                <td className="py-3.5 px-4 text-stone-500 font-mono text-[11px]">{u.email}</td>
                <td className="py-3.5 px-4">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u._id, e.target.value, u.name)}
                    className="border border-[#E5D7BE] bg-[#FAF5EE] rounded-lg px-3 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer shadow-xs hover:border-orange-400 transition-colors"
                  >
                    <option value="admin">Administrator (Super User)</option>
                    <option value="manager">Floor Manager</option>
                    <option value="staff">Staff Cashier</option>
                  </select>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-800 border border-purple-300"
                        : u.role === "manager"
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
