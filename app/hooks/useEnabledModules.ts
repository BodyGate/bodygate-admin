"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useEnabledModules() {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadModules() {
    const { data } = await supabase
      .from("system_modules")
      .select("module_key")
      .eq("is_enabled", true);

    setEnabledModules(
      (data || []).map((m: any) => m.module_key)
    );

    setLoading(false);
  }

  useEffect(() => {
    loadModules();

    const channel = supabase
      .channel("modules-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_modules",
        },
        loadModules
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    enabledModules,
    loading,
  };
}