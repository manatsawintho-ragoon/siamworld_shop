'use client';
// Backward-compatible shim — re-exports next-themes useTheme
// This file exists so admin/layout.tsx doesn't need immediate changes
export { useTheme } from 'next-themes';
export { ThemeProvider } from 'next-themes';
