"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type ThemeName = "bodygate" | "titanium" | "platinum";

const themes: ThemeName[] = ["bodygate", "titanium", "platinum"];

const ThemeContext = createContext<{
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}>({
  theme: "bodygate",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyThemeToDocument(themeName: ThemeName) {
  document.documentElement.setAttribute("data-theme", themeName);
  document.body.setAttribute("data-theme", themeName);
  localStorage.setItem("bodygate-theme", themeName);
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeName>("bodygate");

  function setTheme(themeName: ThemeName) {
    setThemeState(themeName);
    applyThemeToDocument(themeName);
  }

  function toggleTheme() {
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("bodygate-theme") as ThemeName | null;

    if (savedTheme && themes.includes(savedTheme)) {
      setTheme(savedTheme);
    } else {
      setTheme("bodygate");
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        toggleTheme();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}