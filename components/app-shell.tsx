'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { SidebarLayout } from './sidebar-layout';
import { AuthGuard } from './auth-guard';
import { AiAssistantButton } from '@/components/ai-assistant-button';
import { AiContextProvider, useAiContext } from '@/lib/ai-context';
import { useGlobalModalThemeColor } from '@/lib/use-modal-theme-color';

function AiAssistantButtonWithContext() {
  const { aiContext, wizardActive } = useAiContext();
  if (wizardActive) return null;
  return <AiAssistantButton context={aiContext} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  useGlobalModalThemeColor();

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <AuthGuard>{children}</AuthGuard>;
  }


  return (
    <AuthGuard>
      {!loading && user ? (
        <AiContextProvider>
          <SidebarLayout>
            {children}
            <AiAssistantButtonWithContext />
          </SidebarLayout>
        </AiContextProvider>
      ) : null}
    </AuthGuard>
  );
}
