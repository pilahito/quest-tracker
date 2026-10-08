/*
 * QuestTracker by pilahito
 * QuestTracker — quest parsing / lectura de quests
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type QuestKind = "WATCH_VIDEO" | "PLAY_ON_DESKTOP" | "STREAM_ON_DESKTOP" | "PLAY_ACTIVITY" | "WATCH_VIDEO_ON_MOBILE" | "UNKNOWN";

export interface Quest {
    id: string;
    name: string;
    kind: QuestKind;
    reward: string;
    expiresAt?: Date;
    /** True when it expires within the configured window. / True si expira dentro de la ventana configurada. */
    expiringSoon: boolean;
}

const DK = 60 * 60 * 1000;

/** Tolerant extractor: accepts Map, Collection or plain object. / Extractor tolerante. */
function toArray(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw.values === "function") return [...raw.values()];
    if (typeof raw === "object") return Object.values(raw);
    return [];
}

function pickExpiry(q: any): Date | undefined {
    const cfg = q?.config?.expiresAt ?? q?.config?.expires_at;
    const direct = q?.expiresAt ?? q?.expires_at;

    const value = cfg ?? direct;
    if (value == null) return undefined;

    const ms = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
    return Number.isNaN(ms) ? undefined : new Date(ms);
}

function pickName(q: any): string {
    return (
        q?.config?.messages?.questName ??
        q?.config?.messages?.quest_name ??
        q?.config?.application?.name ??
        q?.config?.applicationName ??
        q?.name ??
        q?.id ??
        "?"
    );
}

function pickReward(q: any): string {
    const rewards = q?.config?.rewardsConfig?.rewards ?? q?.config?.rewards ?? [];
    const first = Array.isArray(rewards) ? rewards[0] : undefined;
    if (!first) return "?";

    const amount = first?.value ?? first?.amount ?? first?.quantity;
    const orb = first?.orbQuantity ?? first?.orb_quantity ?? first?.messages?.name;
    if (typeof amount === "number") return `${amount} ${first?.type ?? ""}`.trim();
    return String(orb ?? first?.type ?? "?");
}

function pickKind(q: any): QuestKind {
    const task = q?.config?.taskConfigV2 ?? q?.config?.taskConfig ?? q?.config?.task_config_v2;
    const raw = String(task?.tasks?.WATCH_VIDEO?.type ?? task?.type ?? q?.config?.taskType ?? "").toUpperCase();

    if (raw.includes("WATCH_VIDEO_ON_MOBILE")) return "WATCH_VIDEO_ON_MOBILE";
    if (raw.includes("WATCH_VIDEO")) return "WATCH_VIDEO";
    if (raw.includes("PLAY_ON_DESKTOP")) return "PLAY_ON_DESKTOP";
    if (raw.includes("STREAM_ON_DESKTOP")) return "STREAM_ON_DESKTOP";
    if (raw.includes("PLAY_ACTIVITY")) return "PLAY_ACTIVITY";
    return "UNKNOWN";
}

/**
 * Reads quests from the client store. Read-only: nothing is mutated or sent.
 * Lee las quests del store del cliente. Solo lectura: no se modifica ni se envía nada.
 *
 * @param store       the QuestsStore module / el módulo QuestsStore
 * @param accountIds  connected account ids needed to filter enrollment / cuentas conectadas
 * @param warnHours   window for the "expiring soon" flag / ventana de "expira pronto"
 */
export function readQuests(store: any, accountIds: string[], warnHours = 6): Quest[] {
    const raw = store?.getQuests?.() ?? store?.quests;
    const list = toArray(raw);

    const quests: Quest[] = [];
    const now = Date.now();

    for (const q of list) {
        if (!q) continue;

        const id = String(q.id ?? q.questId ?? "");
        if (!id) continue;

        /** Skip quests already claimed or not yet started. / Omite reclamadas o no iniciadas. */
        const enrolled = q.userStatus?.enrolledAt ?? q.userStatus?.enrolled_at;
        const completed = q.userStatus?.completedAt ?? q.userStatus?.completed_at;
        const claimed = q.userStatus?.claimedAt ?? q.userStatus?.claimed_at;
        if (completed || claimed) continue;

        const expiresAt = pickExpiry(q);
        const expiringSoon =
            expiresAt != null &&
            expiresAt.getTime() - now > 0 &&
            expiresAt.getTime() - now < warnHours * DK;

        quests.push({
            id,
            name: pickName(q),
            kind: pickKind(q),
            reward: pickReward(q),
            expiresAt,
            expiringSoon
        });
    }

    /** Soonest expiry first, quests without expiry last. / Primero las que expiran antes. */
    return quests.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
}
