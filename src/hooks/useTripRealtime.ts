"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime changes on trip_days (for this trip) and
 * activities, invoking `onChange` whenever a collaborator mutates the plan.
 *
 * RLS scopes the realtime stream to rows the current user can see, so the
 * activities subscription (which has no trip_id column to filter on) only
 * delivers events for trips the user is a member of. Calls are debounced so a
 * burst of edits triggers a single refresh.
 */
export function useTripRealtime(tripId: string, onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 250);
    };

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_days",
          filter: `trip_id=eq.${tripId}`,
        },
        fire
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities" },
        fire
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tripId]);
}
