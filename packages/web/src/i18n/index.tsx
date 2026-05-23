import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  hasTranslatableContent,
  translateText,
  type Language,
  type TranslationParams,
} from './translations';

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (source: string, params?: TranslationParams) => string;
}

interface I18nProviderProps {
  children: ReactNode;
}

interface LanguageToggleButtonProps {
  className?: string;
}

type TranslatableAttribute = 'title' | 'placeholder' | 'aria-label' | 'alt';

const LANGUAGE_STORAGE_KEY = 'meshkit.language';
const DEFAULT_LANGUAGE: Language = 'zh';
const TRANSLATABLE_ATTRIBUTES: TranslatableAttribute[] = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIPPED_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
const SKIP_TRANSLATION_SELECTOR = '[data-i18n-skip="true"]';

const I18nContext = createContext<I18nContextValue | null>(null);
const originalTextByNode = new WeakMap<Text, string>();
const originalAttributesByElement = new WeakMap<Element, Partial<Record<TranslatableAttribute, string>>>();

let originalDocumentTitle = '';
let activeDialogLanguage: Language = DEFAULT_LANGUAGE;
let dialogInstallCount = 0;
let originalDialogs: Pick<Window, 'alert' | 'confirm' | 'prompt'> | null = null;

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'zh' ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function writeStoredLanguage(language: Language): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage can be unavailable in privacy modes; language still works in memory.
  }
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || SKIPPED_TEXT_PARENTS.has(parent.tagName) || !!parent.closest(SKIP_TRANSLATION_SELECTOR);
}

function translateTextNode(node: Text, language: Language): void {
  if (shouldSkipTextNode(node)) {
    return;
  }

  const current = node.data;
  let source = originalTextByNode.get(node);

  if (hasTranslatableContent(current) && current !== source) {
    source = current;
    originalTextByNode.set(node, source);
  }

  if (language === 'en' && source && !hasTranslatableContent(current) && current !== translateText(source, language)) {
    originalTextByNode.delete(node);
    return;
  }

  if (!source || !hasTranslatableContent(source)) {
    return;
  }

  const translated = translateText(source, language);
  if (node.data !== translated) {
    node.data = translated;
  }
}

function translateElementAttributes(element: Element, language: Language): void {
  if (element.closest(SKIP_TRANSLATION_SELECTOR)) {
    return;
  }

  let originals = originalAttributesByElement.get(element);

  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
    const current = element.getAttribute(attribute);
    if (current === null) {
      return;
    }

    if (!originals) {
      originals = {};
      originalAttributesByElement.set(element, originals);
    }

    let source = originals[attribute];
    if (hasTranslatableContent(current) && current !== source) {
      source = current;
      originals[attribute] = source;
    }

    if (language === 'en' && source && !hasTranslatableContent(current) && current !== translateText(source, language)) {
      delete originals[attribute];
      return;
    }

    if (!source || !hasTranslatableContent(source)) {
      return;
    }

    const translated = translateText(source, language);
    if (current !== translated) {
      element.setAttribute(attribute, translated);
    }
  });
}

function translateNodeTree(root: Node, language: Language): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  const element = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : null;
  if (element) {
    if (element.closest(SKIP_TRANSLATION_SELECTOR)) {
      return;
    }

    translateElementAttributes(element, language);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).closest(SKIP_TRANSLATION_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.nodeType === Node.TEXT_NODE && shouldSkipTextNode(node as Text)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(current as Element, language);
    }

    current = walker.nextNode();
  }
}

function translateDocument(language: Language): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (!originalDocumentTitle || hasTranslatableContent(document.title)) {
    originalDocumentTitle = document.title;
  }

  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = translateText(originalDocumentTitle, language);
  translateNodeTree(document.body, language);
}

function installDomTranslation(languageRef: React.MutableRefObject<Language>): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  translateDocument(languageRef.current);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target as Text, languageRef.current);
        return;
      }

      if (mutation.type === 'attributes') {
        translateElementAttributes(mutation.target as Element, languageRef.current);
        return;
      }

      mutation.addedNodes.forEach((node) => translateNodeTree(node, languageRef.current));
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
    characterData: true,
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

function installDialogTranslation(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  dialogInstallCount += 1;

  if (!originalDialogs) {
    originalDialogs = {
      alert: window.alert.bind(window),
      confirm: window.confirm.bind(window),
      prompt: window.prompt.bind(window),
    };

    window.alert = (message?: unknown) => {
      originalDialogs?.alert(translateText(String(message ?? ''), activeDialogLanguage));
    };

    window.confirm = (message?: string) => (
      originalDialogs?.confirm(translateText(String(message ?? ''), activeDialogLanguage)) ?? false
    );

    window.prompt = (message?: string, defaultValue?: string) => (
      originalDialogs?.prompt(
        translateText(String(message ?? ''), activeDialogLanguage),
        defaultValue,
      ) ?? null
    );
  }

  return () => {
    dialogInstallCount = Math.max(0, dialogInstallCount - 1);

    if (dialogInstallCount === 0 && originalDialogs) {
      window.alert = originalDialogs.alert;
      window.confirm = originalDialogs.confirm;
      window.prompt = originalDialogs.prompt;
      originalDialogs = null;
    }
  };
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());
  const languageRef = useRef(language);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    writeStoredLanguage(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(languageRef.current === 'zh' ? 'en' : 'zh');
  }, [setLanguage]);

  const t = useCallback(
    (source: string, params?: TranslationParams) => translateText(source, language, params),
    [language],
  );

  useEffect(() => {
    languageRef.current = language;
    activeDialogLanguage = language;
    translateDocument(language);
  }, [language]);

  useEffect(() => installDomTranslation(languageRef), []);
  useEffect(() => installDialogTranslation(), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, t, toggleLanguage],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}

export function LanguageToggleButton({ className = '' }: LanguageToggleButtonProps) {
  const { language, toggleLanguage, t } = useI18n();
  const isChinese = language === 'zh';
  const title = isChinese ? t('切换到英文') : t('切换到中文');

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={title}
      aria-label={title}
      data-i18n-skip="true"
      className={className}
    >
      <span className="text-[11px] font-bold leading-none">{isChinese ? 'EN' : '中'}</span>
    </button>
  );
}

export type { Language };
