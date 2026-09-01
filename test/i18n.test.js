import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGE_STORAGE_KEY, createI18n, resolveLanguage } from "../src/i18n.js";

test("resolves Indonesian browser locales and falls back to English", () => {
  assert.equal(resolveLanguage("id-ID"), "id");
  assert.equal(resolveLanguage("en-US"), "en");
  assert.equal(resolveLanguage("fr-FR"), "en");
});

test("uses a valid stored language and ignores an invalid one", () => {
  assert.equal(resolveLanguage("id-ID", "en"), "en");
  assert.equal(resolveLanguage("en-US", "bahasa"), "en");
});

test("stores a manual language choice and updates the document language", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const attributes = new Map();
  const root = { setAttribute: (key, value) => attributes.set(key, value) };
  const i18n = createI18n({ storage, browserLanguage: "id-ID", root });
  i18n.setLanguage("en");
  assert.equal(i18n.getLanguage(), "en");
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), "en");
  assert.equal(attributes.get("lang"), "en");
  assert.equal(i18n.t("setup.create"), "Create Match");
});

test("translates session expansion actions and modal copy", () => {
  const storage = { getItem: () => null, setItem() {} };
  const i18n = createI18n({ storage, browserLanguage: "id-ID", root: { setAttribute() {} } });
  assert.equal(i18n.t("session.addPlayer"), "Tambah pemain");
  assert.match(i18n.t("playerAdd.success", { name: "Ibnu" }), /Ibnu/);
  i18n.setLanguage("en");
  assert.equal(i18n.t("session.extendDuration"), "Extend duration");
  assert.match(i18n.t("durationAdd.success", { count: 6 }), /6/);
});
