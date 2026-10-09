/**
 * Demonstration build: `VITE_DEMO_MODE=true` at build time.
 *
 * Only then may an unreachable gateway be stood in for by a simulation, and
 * the simulation always says so. A gateway that answers, and above all one
 * that refuses (401, 403), is never masked.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

/** Shown next to the static indicators until they are wired to the tenant. */
export const DEMO_DATA_NOTE =
  "Les indicateurs, incidents et matrices affichés sont des exemples statiques. Seuls le lancement de workflows, l'historique des exécutions et l'assistant interrogent la passerelle Sentinel.";
