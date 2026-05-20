import { createTheme } from "@mui/material/styles";

export const fieldlogTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e7d32", contrastText: "#ffffff" },
    secondary: { main: "#1565c0" },
    background: { default: "#fafafa", paper: "#ffffff" },
    error: { main: "#c62828", contrastText: "#ffffff" },
    warning: { main: "#b15300", contrastText: "#ffffff" },
    success: { main: "#2e7d32", contrastText: "#ffffff" },
    text: {
      primary: "#1a1a1a",
      secondary: "#4a4a4a",
      disabled: "#6b6b6b",
    },
  },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 16,
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 44, minHeight: 44 },
      },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: "outlined", size: "medium" },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});
