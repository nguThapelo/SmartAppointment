"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, fieldErrors, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { dateOnly } from "@/lib/format";

interface U {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "PROVIDER" | "CLIENT";
  isActive: boolean;
  aiEnabled: boolean;
  createdAt: string;
}

export function UsersAdmin({ selfEmail }: { selfEmail: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<U | null>(null);
  const [creating, setCreating] = useState<null | { email: string; firstName: string; lastName: string; role: U["role"] }>(null);

  const users = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => api<{ total: number; data: U[] }>(`/api/admin/users?pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ""}${role ? `&role=${role}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: (u: U) => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { role: u.role, isActive: u.isActive, aiEnabled: u.aiEnabled } }),
    onSuccess: () => { toast("User updated — their sessions were refreshed"); setEditing(null); void qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  const create = useMutation({
    mutationFn: () => api("/api/admin/users", { body: creating }),
    onSuccess: () => { toast("Account created — a set-password link was emailed"); setCreating(null); void qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  const createErrors = create.error instanceof ApiError && create.error.status === 422 ? fieldErrors(create.error.details) : {};

  return (
    <>
      <PageHeader
        title="Users"
        description="Roles can only be changed here. Changing a role or access signs that user out everywhere."
        action={<Button icon={<UserPlus className="size-4" />} onClick={() => { create.reset(); setCreating({ email: "", firstName: "", lastName: "", role: "PROVIDER" }); }}>Add user</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <label htmlFor="user-search" className="sr-only">Search</label>
        <Input id="user-search" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label htmlFor="role-filter" className="sr-only">Role</label>
        <Select id="role-filter" value={role} onChange={(e) => setRole(e.target.value)} className="w-40">
          <option value="">All roles</option><option value="CLIENT">Clients</option><option value="PROVIDER">Providers</option><option value="ADMIN">Admins</option>
        </Select>
      </div>
      <Card>
        {users.isPending ? <Loading /> : users.error ? <div className="p-5"><ErrorNote message={errorMessage(users.error)} /></div> : !users.data.data.length ? <EmptyState title="No users found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr><th className="px-5 py-3 font-medium">Name</th><th className="px-5 py-3 font-medium">Role</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Joined</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.data.data.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><p className="font-medium text-ink-900">{u.firstName} {u.lastName}</p><p className="text-ink-500">{u.email}</p></td>
                    <td className="px-5 py-3"><Badge tone={u.role === "ADMIN" ? "danger" : u.role === "PROVIDER" ? "brand" : "neutral"}>{u.role.toLowerCase()}</Badge></td>
                    <td className="px-5 py-3 space-x-1">{u.isActive ? <Badge tone="success">Active</Badge> : <Badge>Deactivated</Badge>}{!u.aiEnabled && <Badge tone="warning">AI off</Badge>}</td>
                    <td className="px-5 py-3 text-ink-500">{dateOnly(u.createdAt)}</td>
                    <td className="px-5 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => { update.reset(); setEditing(u); }}>Manage</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.firstName} ${editing.lastName}` : ""} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => editing && update.mutate(editing)}>Save</Button></>}>
        {editing && (
          <div className="space-y-3">
            <Field label="Role">
              {(p) => (
                <Select {...p} value={editing.role} disabled={editing.email === selfEmail} onChange={(e) => setEditing({ ...editing, role: e.target.value as U["role"] })}>
                  <option value="CLIENT">Client</option><option value="PROVIDER">Provider</option><option value="ADMIN">Admin</option>
                </Select>
              )}
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" disabled={editing.email === selfEmail} checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-4 rounded border-ink-300" /> Account active
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={editing.aiEnabled} onChange={(e) => setEditing({ ...editing, aiEnabled: e.target.checked })} className="size-4 rounded border-ink-300" /> Can use the assistant
            </label>
            {editing.email === selfEmail && <p className="text-xs text-ink-500">You can’t remove your own admin access.</p>}
            {update.error && <ErrorNote message={errorMessage(update.error)} />}
          </div>
        )}
      </Dialog>

      <Dialog open={!!creating} onClose={() => setCreating(null)} title="Add user" footer={<><Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        {creating && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={createErrors.firstName}>{(p) => <Input {...p} value={creating.firstName} onChange={(e) => setCreating({ ...creating, firstName: e.target.value })} />}</Field>
              <Field label="Last name" error={createErrors.lastName}>{(p) => <Input {...p} value={creating.lastName} onChange={(e) => setCreating({ ...creating, lastName: e.target.value })} />}</Field>
            </div>
            <Field label="Email" error={createErrors.email}>{(p) => <Input {...p} type="email" value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />}</Field>
            <Field label="Role">
              {(p) => (
                <Select {...p} value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value as U["role"] })}>
                  <option value="PROVIDER">Provider</option><option value="CLIENT">Client</option><option value="ADMIN">Admin</option>
                </Select>
              )}
            </Field>
            <p className="text-xs text-ink-500">They’ll get an email to set their own password — you never see or choose it.</p>
            {create.error && <ErrorNote message={errorMessage(create.error)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}
