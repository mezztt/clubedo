import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, ROLE_HINTS, ROLE_LABELS, ROLES_ALL, useVocab } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../components/ui";

interface UserItem { id: number; name: string; email: string; role: string; active: boolean; instructor_id: number | null }
interface InstructorLite { id: number; name?: string; full_name?: string }

function Usuarios() {
  const me = getSessionUser();
  const { t } = useVocab();
  const { show, fail, node: flash } = useFlash();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [instructors, setInstructors] = useState<InstructorLite[]>([]);
  const [editing, setEditing] = useState<UserItem | "new" | null>(null);
  const hasInstructors = canAccess(me, "instructores");

  const load = useCallback(() => { appApi<UserItem[]>("/users").then(setUsers).catch(fail); }, [fail]);
  useEffect(() => {
    load();
    if (hasInstructors) appApi<InstructorLite[] | { items: InstructorLite[] }>("/instructors").then((r) => setInstructors(Array.isArray(r) ? r : r.items || [])).catch(() => {});
  }, [load, hasInstructors]);

  const nameOf = (i: InstructorLite) => i.name || i.full_name || `#${i.id}`;
  const linkName = (u: UserItem) => (u.instructor_id ? instructors.find((i) => i.id === u.instructor_id) : undefined);

  return (
    <section className="products-page">
      <PageHeader eyebrow="USUARIOS" title="Usuarios" subtitle="Quién entra al sistema y qué puede ver cada uno.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </PageHeader>
      <div className="cb-kpis" style={{ marginBottom: 16 }}>
        {ROLES_ALL.map((r) => (
          <div key={r} className="cb-card" style={{ padding: 14 }}><strong>{ROLE_LABELS[r]}</strong><p className="cb-muted" style={{ margin: "4px 0 0" }}>{ROLE_HINTS[r]}</p></div>
        ))}
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="Sin usuarios" /> : (
        <div className="cb-table-wrap">
          <table className="cb-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th>{hasInstructors && <th>{t("instructor", true)}</th>}<th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="is-click" onClick={() => setEditing(u)}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <small>Vos</small>}</td>
                  <td>{u.email}</td>
                  <td><Pill tone={u.role === "ADMINISTRADOR" ? "violet" : u.role === "KIOSCO" ? "gray" : u.role === "INSTRUCTOR" ? "teal" : "blue"}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                  {hasInstructors && <td>{(() => { const l = linkName(u); return l ? nameOf(l) : "—"; })()}</td>}
                  <td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="cb-muted" style={{ marginTop: 12 }}>
        El usuario Kiosco es para la tablet del ingreso: solo sirve para esa pantalla y no ve montos ni datos de las personas.
      </p>
      {editing && <UserForm user={editing === "new" ? null : editing} instructors={instructors} hasInstructors={hasInstructors} isMe={editing !== "new" && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Usuario guardado"); }} />}
      {flash}
    </section>
  );
}

function UserForm({ user, instructors, hasInstructors, isMe, onClose, onSaved }: {
  user: UserItem | null; instructors: InstructorLite[]; hasInstructors: boolean; isMe: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useVocab();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "RECEPCION");
  const [instructor, setInstructor] = useState(user?.instructor_id ? String(user.instructor_id) : "");
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const instructor_id = hasInstructors && instructor && ["INSTRUCTOR", "ADMINISTRADOR", "ENCARGADO"].includes(role) ? Number(instructor) : null;
      if (user) await appApi(`/users/${user.id}`, { method: "PUT", body: { name, role, active, instructor_id, password: password || null } });
      else await appApi("/users", { method: "POST", body: { name, email, password, role, instructor_id } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={user ? "EDITAR USUARIO" : "NUEVO USUARIO"} title={user ? user.name : "Nuevo usuario"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Email (para entrar)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label={user ? "Contraseña nueva (opcional)" : "Contraseña"} hint="Mínimo 6 caracteres"><input value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLES_ALL.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>)}
          </select>
        </Field>
        {hasInstructors && ["INSTRUCTOR", "ADMINISTRADOR", "ENCARGADO"].includes(role) && (
          <Field label={role === "INSTRUCTOR" ? `¿Qué ${t("instructor")} es?` : `¿También da ${t("sessions")}? Vinculalo a su ficha (opcional)`}>
            <select value={instructor} onChange={(e) => setInstructor(e.target.value)}>
              <option value="">{role === "INSTRUCTOR" ? "Elegí…" : "No da clases"}</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name || i.full_name}</option>)}
            </select>
          </Field>
        )}
        {user && !isMe && (
          <div className="cb-inline-checks"><label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Desactivar (no puede entrar)</label></div>
        )}
        {error && <div className="cb-note cb-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Usuarios;
