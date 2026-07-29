export default function AccountDisabledPage() {
  return (
    <main className="bg-tinder flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="text-5xl">🚫</div>
        <h1 className="mt-3 text-xl font-extrabold">Account disabled</h1>
        <p className="mt-2 text-sm text-[var(--body)]">
          Your LunchMatch account has been disabled by an administrator. If you think this is
          a mistake, talk to your admin.
        </p>
      </div>
    </main>
  );
}
