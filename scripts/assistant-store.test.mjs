import test from 'node:test';
import assert from 'node:assert/strict';

import { useAssistantStore } from '../src/store/assistantStore.js';

/**
 * Guards the panel/doors against leaking a non-string value into
 * `initialQuestion`. Regression for the FAB wiring that passed the React
 * SyntheticEvent straight into the store: the auto-answer then appended the
 * event object as a message child and React threw "Objects are not valid as a
 * React child", tripping the global ErrorBoundary on every FAB open.
 */
const synthEvent = {
  _reactName: 'onClick',
  _targetInst: {},
  type: 'click',
  nativeEvent: {},
  target: {},
  currentTarget: {},
  preventDefault() {},
  stopPropagation() {},
};

test('openAssistant() without arguments opens a plain panel', () => {
  useAssistantStore.setState({ open: false, initialQuestion: null });
  useAssistantStore.getState().openAssistant();
  const { open, initialQuestion } = useAssistantStore.getState();
  assert.equal(open, true);
  assert.equal(initialQuestion, null);
});

test('openAssistant(question) seeds the doorway question', () => {
  useAssistantStore.setState({ open: false, initialQuestion: null });
  useAssistantStore.getState().openAssistant('How do I record a sale?');
  const { open, initialQuestion } = useAssistantStore.getState();
  assert.equal(open, true);
  assert.equal(initialQuestion, 'How do I record a sale?');
});

test('openAssistant rejects a React SyntheticEvent (regression)', () => {
  useAssistantStore.setState({ open: false, initialQuestion: null });
  useAssistantStore.getState().openAssistant(synthEvent);
  const { open, initialQuestion } = useAssistantStore.getState();
  assert.equal(open, true);
  assert.equal(initialQuestion, null);
});

test('openAssistant rejects blank strings', () => {
  useAssistantStore.setState({ open: false, initialQuestion: 'stale' });
  useAssistantStore.getState().openAssistant('   ');
  assert.equal(useAssistantStore.getState().initialQuestion, null);
});

test('closeAssistant closes and clears the pending question', () => {
  useAssistantStore.setState({ open: true, initialQuestion: 'Q' });
  useAssistantStore.getState().closeAssistant();
  const { open, initialQuestion } = useAssistantStore.getState();
  assert.equal(open, false);
  assert.equal(initialQuestion, null);
});

test('clearInitial clears only the pending question, not the panel', () => {
  useAssistantStore.setState({ open: true, initialQuestion: 'Q' });
  useAssistantStore.getState().clearInitial();
  const { open, initialQuestion } = useAssistantStore.getState();
  assert.equal(open, true);
  assert.equal(initialQuestion, null);
});