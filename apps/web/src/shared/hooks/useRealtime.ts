"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";

const PLATFORM_MODE = process.env.NEXT_PUBLIC_PLATFORM_MODE ?? "docker";

// docker: connects to the backend's realtime gateway via the same-origin
// /socket.io proxy (next.config.mjs), so the httpOnly accessToken cookie the
// gateway authenticates with is sent automatically (plan §5/§6).
// supabase: subscribes directly to the user's Supabase Realtime broadcast channel
// instead — RealtimeEmitterService (backend) publishes there rather than over
// Redis/Socket.IO in this mode (platform-mode plan §3).
export function useRealtime(onNotification?: (payload: unknown) => void): void {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const user = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (PLATFORM_MODE === "supabase") {
      if (!userId) return;
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      const channel = supabase
        .channel(`user:${userId}`)
        .on("broadcast", { event: "notification" }, ({ payload }) => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          onNotification?.(payload);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const socket = io("/ws", { withCredentials: true });
    socketRef.current = socket;

    socket.on("notification", (payload: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onNotification?.(payload);
    });

    return () => {
      socket.disconnect();
    };
    // onNotification is intentionally not a dependency here — including it would
    // reconnect the socket on every render of any component passing an inline
    // callback, which is the common case (see NotificationBell). This project's
    // eslint config doesn't have eslint-plugin-react-hooks wired up, so there's no
    // exhaustive-deps rule to suppress here.
  }, [queryClient, userId]);
}
