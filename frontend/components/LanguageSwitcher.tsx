'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation, type Locale } from '@/lib/i18n';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'header' | 'sidebar';
}

interface LanguageOption {
  code: Locale;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
];

export default function LanguageSwitcher({ className = '', variant = 'pill' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  const selectLanguage = useCallback(
    (targetLocale: Locale) => {
      if (targetLocale !== locale) {
        setLocale(targetLocale);
      }
      closeDropdown();
      triggerRef.current?.focus();
    },
    [locale, setLocale, closeDropdown]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // Handle global Escape key when open
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  // Focus management when dropdown opens or focus index changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  // Handle keyboard events on the trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        // Focus the currently active language index or first option
        const activeIdx = LANGUAGES.findIndex((l) => l.code === locale);
        setFocusedIndex(activeIdx >= 0 ? activeIdx : 0);
      } else {
        closeDropdown();
      }
    }
  };

  // Handle keyboard navigation between options
  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % LANGUAGES.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + LANGUAGES.length) % LANGUAGES.length);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(LANGUAGES.length - 1);
        break;
      case 'Tab':
        closeDropdown();
        break;
      default:
        break;
    }
  };

  const isSidebar = variant === 'sidebar';

  return (
    <div
      ref={containerRef}
      className={`relative ${isSidebar ? 'w-full' : 'inline-block'} ${className}`}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id="language-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Change language"
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            const activeIdx = LANGUAGES.findIndex((l) => l.code === locale);
            setFocusedIndex(activeIdx >= 0 ? activeIdx : 0);
          } else {
            closeDropdown();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={
          isSidebar
            ? `w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer`
            : `inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer`
        }
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] leading-none" aria-hidden="true">🌐</span>
          <span className="font-semibold">{currentLanguage.label}</span>
        </span>
        <span
          className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${
            isSidebar ? 'text-slate-400' : 'text-slate-400'
          } ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select language"
          className={
            isSidebar
              ? `absolute left-0 bottom-full mb-1.5 w-full bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800`
              : `absolute right-0 top-full mt-1.5 min-w-[150px] w-40 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800`
          }
        >
          {LANGUAGES.map((lang, index) => {
            const isSelected = locale === lang.code;
            return (
              <button
                key={lang.code}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                role="option"
                aria-selected={isSelected}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => selectLanguage(lang.code)}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[#3525cd]/10 text-[#3525cd] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                } focus:outline-none focus:bg-[#3525cd]/15 focus:text-[#3525cd]`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[14px] leading-none" aria-hidden="true">{lang.flag}</span>
                  <span>{lang.label}</span>
                </span>
                {isSelected && (
                  <span
                    className="material-symbols-outlined text-[16px] text-[#3525cd] font-bold"
                    aria-hidden="true"
                  >
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
