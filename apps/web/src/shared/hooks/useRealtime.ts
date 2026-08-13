"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

// Connects to the backend's realtime gateway via the same-origin /socket.io proxy
// (next.config.mjs), so the httpOnly accessToken cookie the gateway authenticates
// with is sent automatically — same reasoning as the /api proxy (plan §5/§6).
export function useRealtime(onNotification?: (payload: unknown) => void): void {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
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
  }, [queryClient]);
}
