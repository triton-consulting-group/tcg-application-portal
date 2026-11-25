import React, { useEffect, useMemo, useState } from "react";
import { canEdit, canChangeActive, roleLabel } from "./permissions";

const PAGE_SIZE = 10;
export default function AdminDirectory({ admins, caller, disabled, onView, onEdit, onStatus }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return admins.filter(admin => (
      (!term || `${admin.name} ${admin.email}`.toLowerCase().includes(term)) &&
      (role === "all" || admin.role === role) &&
      (status === "all" || !!admin.isActive === (status === "active"))
    )).sort((a, b) => {
      if (sort === "lastLogin") return (Date.parse(b.lastLogin) || 0) - (Date.parse(a.lastLogin) || 0) || a.email.localeCompare(b.email);
      return (a[sort] || "").localeCompare(b[sort] || "", undefined, { sensitivity: "base" }) || a.email.localeCompare(b.email);
    });
  }, [admins, search, role, status, sort]);
  useEffect(() => { setPage(1); }, [search, role, status, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <section className="admin-directory" aria-labelledby="admin-directory-title">
      <h2 id="admin-directory-title">Admin directory</h2>
      <div className="admin-filters">
        <label className="admin-search">Search admins<input type="search" placeholder="Search by name or email" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Filter by role<select value={role} onChange={event => setRole(event.target.value)}>
          <option value="all">All roles</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
        </select></label>
        <label>Filter by status<select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select></label>
        <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="name">Name A–Z</option><option value="email">Email A–Z</option><option value="lastLogin">Recent login</option>
        </select></label>
      </div>
      {(search || role !== "all" || status !== "all") && <button type="button" className="admin-button admin-secondary"
        onClick={() => { setSearch(""); setRole("all"); setStatus("all"); }}>Clear filters</button>}
      {visible.length ? <>
        <div className="admin-table-scroll" role="region" aria-label="Admin accounts" tabIndex={0}>
          <table className="admin-table">
            <caption className="admin-sr-only">Admin accounts and available management actions</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last login</th><th scope="col">Actions</th></tr></thead>
            <tbody>{visible.map(admin => <tr key={admin.email}>
              <td>{admin.name}{admin.email === caller.email && <span className="admin-you">You</span>}</td>
              <td>{admin.email}</td><td><span className={`admin-badge ${admin.role === "super_admin" ? "admin-super" : "admin-role"}`}>{roleLabel(admin.role)}</span></td>
              <td><span className={`admin-badge ${admin.isActive ? "admin-active" : "admin-inactive"}`}>{admin.isActive ? "Active" : "Inactive"}</span></td>
              <td>{admin.lastLogin && !Number.isNaN(Date.parse(admin.lastLogin)) ? new Date(admin.lastLogin).toLocaleString() : "Never"}</td>
              <td><div className="admin-actions">
                <button type="button" className="admin-button admin-secondary" disabled={disabled} onClick={() => onView(admin)} aria-label={`View ${admin.email}`}>Details</button>
                {canEdit(caller, admin) && <button type="button" className="admin-button" disabled={disabled} onClick={() => onEdit(admin)} aria-label={`Edit ${admin.email}`}>Edit</button>}
                {canChangeActive(caller, admin) && <button type="button" className={`admin-button ${admin.isActive ? "admin-danger" : "admin-success"}`} disabled={disabled}
                  onClick={() => onStatus(admin)} aria-label={`${admin.isActive ? "Deactivate" : "Reactivate"} ${admin.email}`}>{admin.isActive ? "Deactivate" : "Reactivate"}</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className="admin-pagination" aria-label="Admin directory pages">
          <p role="status">Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} admins</p>
          <div className="admin-actions">
            <button type="button" className="admin-button admin-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {pages}</span>
            <button type="button" className="admin-button admin-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </nav>
      </> : <p className="admin-empty" role="status">{admins.length ? "No admins match these filters." : "No admin accounts to display."}</p>}
    </section>
  );
}
