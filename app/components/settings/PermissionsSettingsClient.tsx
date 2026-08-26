"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Role = {
  id: string;
  role_key: string;
  role_name: string;
  description: string;
};

type Permission = {
  id: string;
  permission_key: string;
  permission_name: string;
  category: string;
};

type RolePermission = {
  role_id: string;
  permission_id: string;
};

export default function PermissionsSettingsClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const { data: rolesData } = await supabase
      .from("staff_roles")
      .select("*")
      .order("role_name");

    const { data: permissionsData } = await supabase
      .from("staff_permissions")
      .select("*")
      .order("category");

    const { data: rolePermissionsData } = await supabase
      .from("staff_role_permissions")
      .select("*");

    setRoles(rolesData || []);
    setPermissions(permissionsData || []);
    setRolePermissions(rolePermissionsData || []);

    setLoading(false);
  }

  async function togglePermission(roleId: string, permissionId: string) {
    const exists = rolePermissions.some(
      (rp) =>
        rp.role_id === roleId &&
        rp.permission_id === permissionId
    );

    if (exists) {
      await supabase
        .from("staff_role_permissions")
        .delete()
        .match({
          role_id: roleId,
          permission_id: permissionId,
        });
    } else {
      await supabase
        .from("staff_role_permissions")
        .insert({
          role_id: roleId,
          permission_id: permissionId,
        });
    }

    loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  const groupedPermissions = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};

    permissions.forEach((permission) => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = [];
      }

      grouped[permission.category].push(permission);
    });

    return grouped;
  }, [permissions]);

  function hasPermission(roleId: string, permissionId: string) {
    return rolePermissions.some(
      (rp) =>
        rp.role_id === roleId &&
        rp.permission_id === permissionId
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>BodyGate Security</p>

          <h1 style={styles.title}>
            Roles & Permissions
          </h1>

          <p style={styles.subtitle}>
            Gestione ruoli staff e permessi granulari
            della piattaforma.
          </p>
        </div>
      </section>

      {loading ? (
        <div style={styles.loading}>
          Caricamento permessi...
        </div>
      ) : (
        Object.entries(groupedPermissions).map(
          ([category, categoryPermissions]) => (
            <section
              key={category}
              style={styles.section}
            >
              <h2 style={styles.sectionTitle}>
                {category}
              </h2>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        Permesso
                      </th>

                      {roles.map((role) => (
                        <th
                          key={role.id}
                          style={styles.th}
                        >
                          {role.role_name}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {categoryPermissions.map(
                      (permission) => (
                        <tr key={permission.id}>
                          <td style={styles.td}>
                            {permission.permission_name}
                          </td>

                          {roles.map((role) => {
                            const active =
                              hasPermission(
                                role.id,
                                permission.id
                              );

                            return (
                              <td
                                key={role.id}
                                style={styles.td}
                              >
                                <button
                                  onClick={() =>
                                    togglePermission(
                                      role.id,
                                      permission.id
                                    )
                                  }
                                  style={{
                                    ...styles.toggle,

                                    background:
                                      active
                                        ? "rgba(31,157,107,0.1)"
                                        : "var(--bg-canvas-raised, #f4f5f9)",

                                    borderColor:
                                      active
                                        ? "rgba(31,157,107,0.4)"
                                        : "var(--bg-border-strong, #d7d9e3)",

                                    color: active ? "#157a53" : "var(--muted)",
                                  }}
                                >
                                  {active
                                    ? "ON"
                                    : "OFF"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        )
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "var(--text)",
  },

  hero: {
    padding: 28,
    borderRadius: 28,
    marginBottom: 24,

    background:
      "linear-gradient(178deg, rgba(192,75,214,0.08), var(--panel) 55%)",

    border: "1px solid var(--border)",
  },

  eyebrow: {
    color: "var(--accent-2, #c04bd6)",
    textTransform: "uppercase",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },

  title: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
    color: "var(--text)",
  },

  subtitle: {
    color: "var(--muted)",
    maxWidth: 700,
  },

  loading: {
    color: "var(--muted)",
  },

  section: {
    marginBottom: 30,
  },

  sectionTitle: {
    marginBottom: 14,
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text)",
  },

  tableWrapper: {
    overflowX: "auto",
    borderRadius: 24,
    border: "1px solid var(--border)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--panel)",
  },

  th: {
    padding: 18,
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 13,
  },

  td: {
    padding: 18,
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
  },

  toggle: {
    border: "1px solid",
    borderRadius: 12,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 70,
  },
};