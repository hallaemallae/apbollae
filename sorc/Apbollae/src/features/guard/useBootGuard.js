// src/features/guard/useBootGuard.js
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export function useBootGuard({ bootTimeoutMs, minSplashMs, fadeDurationMs, onBootTimeout }) {
  const [splashVisible, setSplashVisible] = useState(true);

  const splashStartRef = useRef(Date.now());
  const bootTimerRef = useRef(null);

  const opacity = useRef(new Animated.Value(1)).current;

  const showSplash = useCallback(() => {
    splashStartRef.current = Date.now();
    setSplashVisible(true);
    opacity.setValue(1);
  }, [opacity]);

  const hideSplashRespectingMin = useCallback(() => {
    const elapsed = Date.now() - (splashStartRef.current || Date.now());
    const wait = Math.max((minSplashMs || 0) - elapsed, 0);

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: fadeDurationMs || 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setSplashVisible(false);
        opacity.setValue(1); // 다음 show 대비
      });
    }, wait);
  }, [fadeDurationMs, minSplashMs, opacity]);

  const startBootTimeout = useCallback(() => {
    if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
    bootTimerRef.current = setTimeout(() => {
      try {
        onBootTimeout?.();
      } catch {}
    }, bootTimeoutMs);
  }, [bootTimeoutMs, onBootTimeout]);

  const clearBootTimeout = useCallback(() => {
    if (bootTimerRef.current) {
      clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
    };
  }, []);

  return {
    splashVisible,
    splashOpacity: opacity,
    showSplash,
    hideSplashRespectingMin,
    startBootTimeout,
    clearBootTimeout,
  };
}
