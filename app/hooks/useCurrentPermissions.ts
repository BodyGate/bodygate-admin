"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "owner",
  "proprietario",
  "super_admin",
  "amministrazione",
  "amministratore",
]);

type CurrentAuthResponse = {
  ok: boolean;
  role_key?: string | null;
  staff_name?: string | null;
  permissions?: string[];
  is_admin?: boolean;
};

type CurrentPermissionsState = {
  permissions: string[];
  roleKey: string | null;
  staffName: string | null;
  serverIsAdmin: boolean;
  loading: boolean;
  loaded: boolean;
};

const INITIAL_STATE: CurrentPermissionsState = {
  permissions: [],
  roleKey: null,
  staffName: null,
  serverIsAdmin: false,
  loading: true,
  loaded: false,
};

const REFRESH_DEDUP_MS = 30_000;
const subscribers = new Set<() => void>();
let state = INITIAL_STATE;
let inFlight: Promise<void> | null = null;
let lastLoadedAt = 0;
let listenersRegistered = false;

function normalizeRoleKey(roleKey?: string | null) {
  return roleKey?.toLowerCase().trim() || null;
}

export function isAdminRole(roleKey?: string | null) {
  const normalized = normalizeRoleKey(roleKey);
  return normalized ? ADMIN_ROLE_KEYS.has(normalized) : false;
}

function emit() {
  subscribers.forEach((subscriber) => subscriber());
}

function setState(nextState: CurrentPermissionsState) {
  state = nextState;
  emit();
}

function resetPermissions() {
  lastLoadedAt = Date.now();
  setState({ ...INITIAL_STATE, loading: false, loaded: true });
}

function subscribe(listener: () => void) {
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return INITIAL_STATE;
}

function redirectToLoginIfNeeded(status: number) {
  if (
    status === 401 &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login"
  ) {
    window.location.assign("/login");
  }
}

async function refreshPermissions(options: { showLoading?: boolean; force?: boolean } = {}) {
  if (typeof window === "undefined") return;

  const { showLoading = false, force = false } = options;
  const now = Date.now();

  if (inFlight) {
    return inFlight;
  }

  if (!force && state.loaded && now - lastLoadedAt < REFRESH_DEDUP_MS) {
    return;
  }

  if (showLoading && !state.loading) {
    setState({ ...state, loading: true });
  }

  inFlight = (async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        resetPermissions();
        redirectToLoginIfNeeded(response.status);
        return;
      }

      const result = (await response.json()) as CurrentAuthResponse;

      if (!result.ok) {
        resetPermissions();
        return;
      }

      lastLoadedAt = Date.now();
      setState({
        permissions: Array.isArray(result.permissions) ? result.permissions : [],
        roleKey: result.role_key || null,
        staffName: result.staff_name || null,
        serverIsAdmin: Boolean(result.is_admin),
        loading: false,
        loaded: true,
      });
    } catch (error) {
      console.warn("Errore caricamento permessi:", error);
      lastLoadedAt = Date.now();
      setState({ ...state, loading: false, loaded: true });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function registerGlobalRefreshListeners() {
  if (listenersRegistered || typeof window === "undefined") return;

  const handleFocus = () => {
    void refreshPermissions();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void refreshPermissions();
    }
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  listenersRegistered = true;
}

export function useCurrentPermissions() {
  const {
    permissions,
    roleKey,
    staffName,
    serverIsAdmin,
    loading,
    loaded,
  } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    registerGlobalRefreshListeners();
    void refreshPermissions({ showLoading: !loaded, force: !loaded });
  }, [loaded]);

  const isAdmin = serverIsAdmin || isAdminRole(roleKey);

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (isAdmin) return true;

      return permissions.includes(permissionKey);
    },
    [isAdmin, permissions]
  );

  return {
    permissions,
    roleKey,
    staffName,
    loading,
    hasPermission,
    isAdmin,
  };
}
