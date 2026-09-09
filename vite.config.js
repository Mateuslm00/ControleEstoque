import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração padrão do Vite para um projeto React (SPA).
// "server.port" fixa a porta do localhost em 5173 (padrão do Vite),
// mude aqui se precisar rodar em outra porta.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
