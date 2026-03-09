import { describe, it, expect } from 'vitest';
import {
  deriveFacts,
  getInteractionState,
  canWave,
  InteractionState,
  type InteractionData,
  type InteractionFacts,
} from '@/lib/interactionRules';
import { formatRemainingTime } from '@/config/presence';

const USER_A = 'aaa-111';
const USER_B = 'bbb-222';
const PLACE = 'place-1';
const NOW = new Date('2025-06-01T12:00:00Z');

const emptyData: InteractionData = { blocks: [], mutes: [], conversations: [], waves: [] };

// Helper: default facts (no interaction)
const baseFacts: InteractionFacts = {
  isBlockedByMe: false,
  isBlockedByOther: false,
  isMutedByA: false,
  hasActiveChat: false,
  hasCooldown: false,
  cooldownByA: false,
  hasAnyConversation: false,
  closedByA: false,
  hasWaveFromB: false,
  hasWaveFromA: false,
  hasIgnoreCooldownFromB: false,
};

describe('interactionRules – deriveFacts', () => {
  it('returns NONE state with empty data', () => {
    const facts = deriveFacts(USER_A, USER_B, PLACE, NOW, emptyData);
    const result = getInteractionState(facts);
    expect(result.state).toBe(InteractionState.NONE);
    expect(result.button.label).toBe('Acenar');
    expect(result.isVisible).toBe(true);
  });

  it('detects pending wave from A→B', () => {
    const data: InteractionData = {
      ...emptyData,
      waves: [{
        id: 'w1', de_user_id: USER_A, para_user_id: USER_B,
        place_id: PLACE, status: 'pending', expires_at: '2025-06-01T13:00:00Z',
      }],
    };
    const facts = deriveFacts(USER_A, USER_B, PLACE, NOW, data);
    expect(facts.hasWaveFromA).toBe(true);
    expect(facts.hasWaveFromB).toBe(false);
    const result = getInteractionState(facts);
    expect(result.state).toBe(InteractionState.WAVE_SENT);
  });

  it('detects block by other user → invisible', () => {
    const data: InteractionData = {
      ...emptyData,
      blocks: [{ user_id: USER_B, blocked_user_id: USER_A }],
    };
    const facts = deriveFacts(USER_A, USER_B, PLACE, NOW, data);
    expect(facts.isBlockedByOther).toBe(true);
    const result = getInteractionState(facts);
    expect(result.state).toBe(InteractionState.BLOCKED);
    expect(result.isVisible).toBe(false);
  });

  it('detects active mute → canWave returns false', () => {
    const data: InteractionData = {
      ...emptyData,
      mutes: [{
        user_id: USER_A, muted_user_id: USER_B,
        expira_em: '2025-06-02T12:00:00Z', // future
      }],
    };
    const facts = deriveFacts(USER_A, USER_B, PLACE, NOW, data);
    expect(facts.isMutedByA).toBe(true);
    expect(canWave(facts).allowed).toBe(false);
    expect(getInteractionState(facts).state).toBe(InteractionState.MUTED);
  });
});

describe('interactionRules – getInteractionState precedence', () => {
  it('block takes priority over mute + wave', () => {
    const facts: InteractionFacts = {
      ...baseFacts,
      isBlockedByMe: true,
      isMutedByA: true,
      hasWaveFromB: true,
    };
    const result = getInteractionState(facts);
    expect(result.state).toBe(InteractionState.BLOCKED);
  });
});

describe('formatRemainingTime', () => {

  it('returns 0:00 for zero or negative', () => {
    expect(formatRemainingTime(0)).toBe('0:00');
    expect(formatRemainingTime(-5000)).toBe('0:00');
  });

  it('formats minutes and seconds with zero-padding', () => {
    expect(formatRemainingTime(65000)).toBe('1:05');
    expect(formatRemainingTime(3600000)).toBe('60:00');
    expect(formatRemainingTime(30000)).toBe('0:30');
  });

  it('handles sub-second values', () => {
    expect(formatRemainingTime(500)).toBe('0:00');
    expect(formatRemainingTime(1500)).toBe('0:01');
  });
});
