/**
 * useMultiplayer.ts — Hook para Colaboração em Tempo Real (T3-134).
 * Gerencia Presence (quem está online) e Broadcast (mudanças no mapa).
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import Logger from "../utils/logger";

export interface MultiplayerUser {
  id: string;
  name: string;
  cursor?: { x: number; y: number };
  onlineAt: string;
}

export interface MultiplayerEvent {
  type: "asset_moved" | "asset_added" | "asset_deleted" | "chat_message";
  payload: any;
  senderId: string;
}

export function useMultiplayer(
  projetoId: string,
  currentUser: { id: string; name: string },
) {
  const [onlineUsers, setOnlineUsers] = useState<MultiplayerUser[]>([]);
  const [lastEvent, setLastEvent] = useState<MultiplayerEvent | null>(null);

  useEffect(() => {
    if (!supabase || !projetoId) return;

    const channel = supabase.channel(`project:${projetoId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    // 1. Presence: Rastrear usuários online
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: MultiplayerUser[] = [];

        for (const id in state) {
          const p = state[id]?.[0] as any;
          if (p) {
            users.push({
              id: p.id,
              name: p.name,
              onlineAt: p.onlineAt,
            });
          }
        }
        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        Logger.info("[Multiplayer] Novo usuário entrou", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        Logger.info("[Multiplayer] Usuário saiu", leftPresences);
      });

    // 2. Broadcast: Receber eventos de outros usuários
    channel.on("broadcast", { event: "map_update" }, ({ payload }) => {
      setLastEvent(payload as MultiplayerEvent);
    });

    // Subscrever
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: currentUser.id,
          name: currentUser.name,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [projetoId, currentUser.id, currentUser.name]);

  const emitEvent = useCallback(
    async (event: Omit<MultiplayerEvent, "senderId">) => {
      if (!supabase || !projetoId) return;

      const fullEvent: MultiplayerEvent = {
        ...event,
        senderId: currentUser.id,
      };

      await supabase.channel(`project:${projetoId}`).send({
        type: "broadcast",
        event: "map_update",
        payload: fullEvent,
      });
    },
    [projetoId, currentUser.id],
  );

  return { onlineUsers, lastEvent, emitEvent };
}
