/**
 * Withdraw is an Authority act, not a CMS delete.
 * Records remain. current_state_id is cleared so listings that already
 * require an authorised current state stop presenting the work.
 * Super Hero Ego cannot be withdrawn.
 */

import { isProtectedMaster } from "./protected-work";

export type WithdrawDecision =
  | { ok: true; action: "withdraw" | "already_withdrawn"; masterId: string; message: string }
  | {
      ok: false;
      code: "invalid_master" | "protected_work";
      masterId: string | null;
      message: string;
    };

export function decideWithdraw(input: {
  masterId: string | null;
  currentStateId?: string | null;
}): WithdrawDecision {
  const masterId = input.masterId?.trim() || null;
  if (!masterId) {
    return {
      ok: false,
      code: "invalid_master",
      masterId: null,
      message: "A canonical work is required to withdraw.",
    };
  }

  if (isProtectedMaster(masterId)) {
    return {
      ok: false,
      code: "protected_work",
      masterId,
      message: "Super Hero Ego is curated canonical work. It cannot be withdrawn.",
    };
  }

  if (input.currentStateId === null) {
    return {
      ok: true,
      action: "already_withdrawn",
      masterId,
      message: "This work is already withdrawn from Discover.",
    };
  }

  return {
    ok: true,
    action: "withdraw",
    masterId,
    message: "Withdraw this work from Discover. Records are preserved. This is not a delete.",
  };
}
