import assert from "node:assert/strict";
import { test } from "node:test";
import { getSpeechRecognitionConstructor } from "../../src/ui/speech-recognition.ts";

test("returns undefined when the window has neither constructor", () => {
  assert.equal(getSpeechRecognitionConstructor(undefined), undefined);
  assert.equal(getSpeechRecognitionConstructor({}), undefined);
});

test("returns the unprefixed constructor when present", () => {
  function FakeSpeechRecognition() {}
  const win = { SpeechRecognition: FakeSpeechRecognition };
  assert.equal(getSpeechRecognitionConstructor(win), FakeSpeechRecognition);
});

test("falls back to the WebKit-prefixed constructor when only that is present", () => {
  function FakeWebkitSpeechRecognition() {}
  const win = { webkitSpeechRecognition: FakeWebkitSpeechRecognition };
  assert.equal(getSpeechRecognitionConstructor(win), FakeWebkitSpeechRecognition);
});

test("prefers the unprefixed constructor when both are present", () => {
  function FakeSpeechRecognition() {}
  function FakeWebkitSpeechRecognition() {}
  const win = { SpeechRecognition: FakeSpeechRecognition, webkitSpeechRecognition: FakeWebkitSpeechRecognition };
  assert.equal(getSpeechRecognitionConstructor(win), FakeSpeechRecognition);
});
