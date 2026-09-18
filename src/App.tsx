import { ThemeProvider } from 'next-themes';
import { AppLayout } from './components/AppLayout';
import { Toaster } from './components/ui/sonner';
import { ReviewSession } from './components/ReviewSession';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ReviewSession><AppLayout /></ReviewSession>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
