import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;
const getSharedSocket = (): Socket => {
  if (!sharedSocket) {
    const rawUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
    const socketHost = rawUrl ? rawUrl.replace(/\/api$/, "") : "/";
    sharedSocket = io(socketHost, {
      path: "/socket.io",
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return sharedSocket;
};

export const useSocket = (onEvent: (event: string, payload: unknown) => void) => {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const socket = getSharedSocket();

    const handleProductUpdated = (payload: unknown) => onEventRef.current("product:updated", payload);
    const handleSaleNew = (payload: unknown) => onEventRef.current("sale:new", payload);
    const handlePlanogramUpdated = (payload: unknown) => onEventRef.current("planogram_updated", payload);
    const handleFloorSwapExecuted = (payload: unknown) => onEventRef.current("floor_swap_executed", payload);

    socket.on("product:updated", handleProductUpdated);
    socket.on("sale:new", handleSaleNew);
    socket.on("planogram_updated", handlePlanogramUpdated);
    socket.on("floor_swap_executed", handleFloorSwapExecuted);

    // Dynamic wildcard handler so all socket events are delivered
    const handleAny = (event: string, ...args: unknown[]) => {
      onEventRef.current(event, args[0]);
    };
    socket.onAny(handleAny);

    return () => {
      socket.off("product:updated", handleProductUpdated);
      socket.off("sale:new", handleSaleNew);
      socket.off("planogram_updated", handlePlanogramUpdated);
      socket.off("floor_swap_executed", handleFloorSwapExecuted);
      socket.offAny(handleAny);
    };
  }, []);

  const socketRef = useRef<Socket | null>(sharedSocket);
  return socketRef;
};
