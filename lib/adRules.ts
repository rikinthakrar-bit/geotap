// lib/adRules.ts

/** Simple, testable rules for when to show ads. 
 * Call these from the places that launch a session/round/retry.
 *
 * Conventions:
 * - For "first time" checks, pass a 1-based counter (1 = first session/round/retry).
 * - Keep counters per mode in your own screen code (e.g., via AsyncStorage).
 */

export function shouldShowPracticeInterstitial(sessionCount: number): boolean {
  // Before first game, then every 2 practice games (1, 3, 5, ...)
  return sessionCount === 1 || sessionCount % 2 === 1;
}

export function shouldShowArchiveInterstitial(sessionCount: number): boolean {
  // Before first play, then every 2 archive games (1, 3, 5, ...)
  return sessionCount === 1 || sessionCount % 2 === 1;
}

export function shouldShowChallengeRoundRewarded(roundIndex: number): boolean {
  // After round 2 and after round 4
  return roundIndex === 2 || roundIndex === 4;
}

export function shouldShowChallengeRetryRewarded(retryCount: number): boolean {
  // On 1st retry, 3rd retry, ...
  return retryCount === 1 || retryCount === 3;
}