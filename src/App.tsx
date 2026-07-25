import { ThemeProvider } from 'next-themes';
import { AppLayout } from './components/AppLayout';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AppLayout />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
