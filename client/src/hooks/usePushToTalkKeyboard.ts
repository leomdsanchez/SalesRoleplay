import { useEffect, useState } from "react";

export interface UsePushToTalkKeyboardOptions {
  enabled: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  key?: string;
}

/**
 * Hook para gerenciar push-to-talk via teclado
 * Detecta quando usuário segura/solta uma tecla (padrão: espaço)
 */
export function usePushToTalkKeyboard({
  enabled,
  onPressStart,
  onPressEnd,
  key = "Space",
}: UsePushToTalkKeyboardOptions) {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if already pressed or is a repeat event
      if (e.code === key && !e.repeat && !isPressed) {
        e.preventDefault();
        console.log(`[PushToTalkKeyboard] Key pressed: ${key}`);
        setIsPressed(true);
        onPressStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === key && isPressed) {
        e.preventDefault();
        console.log(`[PushToTalkKeyboard] Key released: ${key}`);
        setIsPressed(false);
        onPressEnd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, isPressed, key, onPressStart, onPressEnd]);

  return {
    isPressed,
  };
}
