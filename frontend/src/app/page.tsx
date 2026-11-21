import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">jblog</h1>
      <ThemeToggle />
    </main>
  );
}
