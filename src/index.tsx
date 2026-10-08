/*
 * QuestTracker by pilahito
 * QuestTracker — read-only Quest tracker / Rastreador de Quests (solo lectura)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { DataStore } from "@api/index";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

import { t, type Lang } from "./i18n";
import { Quest, QuestKind, readQuests } from "./quests";

/** Notas / Notes:
 *  - This plugin ONLY reads the quest list that the client already received.
 *    It never talks to Discord's API, never patches any tracking module and
 *    never reports progress. / Este plugin SOLO lee la lista de quests que el
 *    cliente ya recibió. Nunca llama a la API de Discord, nunca parchea ningún
 *    módulo de seguimiento y nunca reporta progreso.
 */

const QuestsStore = findByPropsLazy("getQuests", "getQuest");

const logger = new Logger("QuestTracker");

const SEEN_KEY = "QuestTracker_seenQuestIds";

const settings = definePluginSettings({
    lang: {
        type: OptionType.SELECT,
        description: "Language / Idioma",
        options: [
            { label: "Español", value: "es", default: true },
            { label: "English", value: "en" }
        ]
    },
    notifyNew: {
        type: OptionType.BOOLEAN,
        description: "Notify when a new quest appears / Avisar cuando aparece una quest nueva",
        default: true
    },
    notifyExpiring: {
        type: OptionType.BOOLEAN,
        description: "Notify about quests about to expire / Avisar de quests a punto de expirar",
        default: true
    },
    expiryHours: {
        type: OptionType.NUMBER,
        description: "Hours before expiry to warn / Horas antes de expirar para avisar",
        default: 6,
        disabled: () => !settings.store.notifyExpiring
    },
    logToConsole: {
        type: OptionType.BOOLEAN,
        description: "Log the quest list to the console / Volcar la lista de quests en la consola",
        default: false
    }
});

let onChange: (() => void) | undefined;

function readConnectedAccountIds(): string[] {
    const ids: string[] = [];
    const accounts = (UserStore as any)?.getCurrentUser?.()?.connectedAccounts;
    if (Array.isArray(accounts)) {
        for (const acc of accounts) {
            const id = acc?.id ?? acc?.external_id;
            if (typeof id === "string") ids.push(id);
        }
    }
    return ids;
}

function extractQuests(): Quest[] {
    try {
        return readQuests(QuestsStore, readConnectedAccountIds());
    } catch (error) {
        logger.error("Failed to read quests / No se pudieron leer las quests", error);
        return [];
    }
}

/** Snapshot only — never writes back into the store. / Solo lectura. */
function snapshot(): Quest[] {
    const quests = extractQuests();
    if (!settings.store.logToConsole) return quests;

    logger.info(`Found / Encontradas: ${quests.length} quest(s)`);
    for (const q of quests) {
        logger.info(
            `- ${q.name} [${q.kind}] expires/expira ${q.expiresAt?.toLocaleString() ?? "?"} ` +
            `(${q.expiringSoon ? "SOON / PRONTO" : "ok"})`
        );
    }
    return quests;
}

/** Toast + optional desktop notification. / Toast + notificación de escritorio. */
function notify(title: string, body: string, notifyDesktop = true) {
    try {
        const mod = findByPropsLazy("showToast");
        mod?.showToast?.(body, {});
    } catch {
        logger.info(`${title} — ${body}`);
    }

    if (!notifyDesktop) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
        new Notification(title, { body, silent: false });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(p => {
            if (p === "granted") new Notification(title, { body });
        });
    }
}

async function checkForChanges() {
    const quests = snapshot();
    if (!quests.length) return;

    const lang = settings.store.lang as Lang;
    const seen = new Set<string>((await DataStore.get(SEEN_KEY)) ?? []);

    /** First run: record everything silently. / Primera ejecución: registrar sin avisar. */
    if (seen.size === 0) {
        await DataStore.set(SEEN_KEY, quests.map(q => q.id));
        logger.info(t(lang, "firstRun") + ` (${quests.length})`);
        return;
    }

    const fresh = quests.filter(q => !seen.has(q.id));
    if (fresh.length && settings.store.notifyNew) {
        for (const q of fresh) {
            notify(t(lang, "newQuest"), `${q.name} — ${t(lang, "reward")}: ${q.reward}`);
        }
    }

    if (settings.store.notifyExpiring) {
        const soon = quests.filter(q => q.expiringSoon && !fresh.includes(q));
        for (const q of soon) {
            notify(t(lang, "expiringSoon"), `${q.name} — ${q.expiresAt?.toLocaleString() ?? ""}`);
        }
    }

    if (fresh.length) {
        await DataStore.set(SEEN_KEY, [...seen, ...fresh.map(q => q.id)]);
    }
}

function getQuestKind(q: Quest): QuestKind {
    return q.kind;
}

export default definePlugin({
    name: "QuestTracker",
    description:
        "Read-only Discord quest tracker: detects new quests and warns before they expire. " +
        "Rastreador de quests de solo lectura: detecta quests nuevas y avisa antes de que expiren.",
    authors: [{ name: "pilahito", id: 0n }],

    settings,

    /** Fast method used by the future panel. / Método rápido para el panel futuro. */
    getQuests: snapshot,
    getQuestKind,

    start() {
        /** Give the store a moment to exist, then subscribe. / Espera a que el store exista. */
        setTimeout(() => {
            if (!QuestsStore) {
                logger.warn(
                    "QuestsStore not found. Open the Quests tab once and reload. / " +
                    "No se encontró QuestsStore. Abre la pestaña Quests una vez y recarga."
                );
                return;
            }

            onChange = () => void checkForChanges();
            FluxDispatcher.subscribe("QUESTS_FETCH_CURRENT_QUESTS_SUCCESS", onChange);
            FluxDispatcher.subscribe("QUESTS_FETCH_CURRENT_QUESTS_FAILURE", onChange);
            FluxDispatcher.subscribe("QUESTS_UPDATE_QUEST", onChange);

            void checkForChanges();
        }, 5000);
    },

    stop() {
        if (onChange) {
            FluxDispatcher.unsubscribe("QUESTS_FETCH_CURRENT_QUESTS_SUCCESS", onChange);
            FluxDispatcher.unsubscribe("QUESTS_FETCH_CURRENT_QUESTS_FAILURE", onChange);
            FluxDispatcher.unsubscribe("QUESTS_UPDATE_QUEST", onChange);
        }
        onChange = undefined;
    }
});
