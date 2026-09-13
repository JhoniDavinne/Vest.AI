"use client";

/**
 * Perfil do consumidor na sessao do navegador.
 * Persistimos apenas o id do usuario (os dados vivem no backend) e um cache
 * leve para evitar flicker. Nada sensivel fica no localStorage.
 */
import * as React from "react";
import type { User } from "@veste-ai/contracts";
import { api } from "./api";

const STORAGE_KEY = "veste.profile.userId";

interface ProfileContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const id = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!id) {
      setUserState(null);
      setLoading(false);
      return;
    }
    try {
      const fetched = await api.getUser(id);
      setUserState(fetched);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setUserState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const setUser = React.useCallback((next: User | null) => {
    setUserState(next);
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(STORAGE_KEY, next.id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const clear = React.useCallback(() => setUser(null), [setUser]);

  const value = React.useMemo(() => ({ user, loading, setUser, refresh, clear }), [user, loading, setUser, refresh, clear]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile deve ser usado dentro de ProfileProvider");
  return ctx;
}
