/*
 * QuestTracker by pilahito
 * QuestTracker — bilingual strings / textos bilingües
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type Lang = "es" | "en";

const strings = {
    es: {
        firstRun: "Primera ejecución: quests registradas sin avisar",
        newQuest: "Quest nueva disponible",
        expiringSoon: "Quest a punto de expirar",
        reward: "Recompensa"
    },
    en: {
        firstRun: "First run: quests recorded silently",
        newQuest: "New quest available",
        expiringSoon: "Quest about to expire",
        reward: "Reward"
    }
} as const;

export function t(lang: Lang, key: keyof (typeof strings)["es"]): string {
    return strings[lang]?.[key] ?? strings.es[key];
}
