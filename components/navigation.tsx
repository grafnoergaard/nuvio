'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Wallet } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const budgetIdMatch = pathname.match(/\/budgets\/([^\/]+)/);
  const budgetId = budgetIdMatch ? budgetIdMatch[1] : null;
  const isInBudget = budgetId && budgetId !== 'new';

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto">
        <div className="flex h-16 items-center gap-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            <span className="font-bold text-xl">Balancio Pro</span>
          </div>
          <div className="flex gap-2 ml-8">
            <Button
              variant={pathname === '/budgets' ? 'default' : 'ghost'}
              onClick={() => router.push('/budgets')}
            >
              Budgetter
            </Button>
            {isInBudget && (
              <>
                <Button
                  variant={pathname.includes('/transactions') ? 'default' : 'ghost'}
                  onClick={() => router.push(`/budgets/${budgetId}/transactions`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Posteringer
                </Button>
                <Button
                  variant={pathname.includes('/import') ? 'default' : 'ghost'}
                  onClick={() => router.push(`/budgets/${budgetId}/import`)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
