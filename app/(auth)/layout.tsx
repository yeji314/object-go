export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10 bg-gradient-to-b from-blue-50 to-white">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
