import { matchKeywords } from '@conversa/shared';
import type { MatchMode, PostScope } from '../../generated/prisma/client.js';

export interface CandidateAutomation {
  id: string;
  postScope: PostScope;
  mediaIds: string[];
  scopeResolvedAt: Date | null;
  matchMode: MatchMode;
  keywords: string[];
  wholeWord: boolean;
  createdAt: Date;
}

export interface Selection<T extends CandidateAutomation> {
  automation: T;
  matchedKeyword: string | null;
}

/**
 * Picks the one automation that answers a comment or message.
 *
 * A platform allows a single private reply per comment, and two automations
 * answering the same message would read as spam, so at most one fires. The
 * most specific wins: an automation bound to this post beats one listening to
 * every post, a keyword match beats "anything", and among equals the newest
 * wins.
 */
export function selectAutomation<T extends CandidateAutomation>(
  candidates: readonly T[],
  event: { text: string; mediaIds?: readonly string[] },
): Selection<T> | null {
  let best: { selection: Selection<T>; score: number } | null = null;

  for (const automation of candidates) {
    let scopeScore = 0;
    if (event.mediaIds) {
      const boundToPost = automation.mediaIds.some((id) => event.mediaIds?.includes(id));
      if (automation.postScope === 'ANY') scopeScore = 1;
      else if (boundToPost) scopeScore = 2;
      else continue;
    }

    let matchedKeyword: string | null = null;
    if (automation.matchMode === 'KEYWORDS') {
      const match = matchKeywords(event.text, automation.keywords, automation.wholeWord);
      if (!match.matched) continue;
      matchedKeyword = match.keyword;
    }

    const score = scopeScore * 10 + (matchedKeyword ? 1 : 0);
    const isBetter =
      !best ||
      score > best.score ||
      (score === best.score && automation.createdAt > best.selection.automation.createdAt);
    if (isBetter) best = { selection: { automation, matchedKeyword }, score };
  }
  return best?.selection ?? null;
}
