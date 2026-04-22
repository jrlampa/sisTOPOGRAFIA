import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { SETTINGS_STORAGE_KEY } from "../../src/constants/magicNumbers";
import {
  getAppLocaleLabel,
  normalizeAppLocale,
  SUPPORTED_APP_LOCALES,
} from "../../src/i18n/appLocale";
import { loadPersistedAppSettings } from "../../src/utils/preferencesPersistence";

describe("appLocale", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normaliza locale exato e atalhos por idioma", () => {
    expect(normalizeAppLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeAppLocale("en")).toBe("en-US");
    expect(normalizeAppLocale("es-MX")).toBe("es-ES");
  });

  it("faz fallback para pt-BR quando locale não é suportado", () => {
    expect(normalizeAppLocale("fr-FR")).toBe("pt-BR");
    expect(normalizeAppLocale(undefined)).toBe("pt-BR");
  });

  it("expõe catálogo e rótulos de locales suportados", () => {
    expect(SUPPORTED_APP_LOCALES).toEqual(["pt-BR", "en-US", "es-ES"]);
    expect(getAppLocaleLabel("pt-BR")).toBe("Português (Brasil)");
    expect(getAppLocaleLabel("en-US")).toBe("English (US)");
  });

  it("carrega locale persistido já normalizado", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ locale: "en", projectMetadata: { projectName: "Teste" } }),
    );

    const loadedSettings = loadPersistedAppSettings(INITIAL_APP_STATE.settings);

    expect(loadedSettings.locale).toBe("en-US");
    expect(loadedSettings.projectMetadata.projectName).toBe("Teste");
    expect(loadedSettings.projectMetadata.companyName).toBe(
      INITIAL_APP_STATE.settings.projectMetadata.companyName,
    );
  });
});