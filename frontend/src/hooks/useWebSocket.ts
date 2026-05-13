"use client";

import { useEffect, useRef, useCallback } from "react";
import { connectSocket, disconnectSocket } from "@/lib/ws";
import type { Socket } from "socket.io-client";

export function useWebSocket(channel: string, onMessage: (data: any) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on(channel, onMessage);

    return () => {
      socket.off(channel, onMessage);
    };
  }, [channel, onMessage]);

  return socketRef;
}
