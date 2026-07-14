export function ChannelHeader({ name }: { name: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-black/20 px-4 text-white shadow-sm">
      <span className="mr-2 text-gray-400">#</span>
      <span className="font-semibold">{name}</span>
    </header>
  );
}
