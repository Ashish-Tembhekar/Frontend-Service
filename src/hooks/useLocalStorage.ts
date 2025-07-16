// src/hooks/useLocalStorage.ts
"use client";

import { useState, useEffect, type Dispatch, type SetStateAction, useCallback } from 'react';

type SetValue<T> = Dispatch<SetStateAction<T>>;

function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    setStoredValue(readValue());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Read only on mount - key and readValue are stable or correctly handled

  const setValue: SetValue<T> = useCallback(
    (valueOrFn) => {
      if (typeof window === 'undefined') {
        console.warn(
          `Tried setting localStorage key “${key}” even though environment is not a client`
        );
        return;
      }
      try {
        // Use a functional update with setStoredValue to avoid needing storedValue in deps of setValue
        setStoredValue(prevStoredValue => {
          const newValue = valueOrFn instanceof Function ? valueOrFn(prevStoredValue) : valueOrFn;
          window.localStorage.setItem(key, JSON.stringify(newValue));
          return newValue;
        });
      } catch (error) {
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key] // Now setValue callback is stable
  );
  
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        // When storage changes in another tab, re-read the value
        setStoredValue(readValue());
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key, readValue]); // readValue is stable due to its own deps

  return [storedValue, setValue];
}

export default useLocalStorage;
