import Nav from "@/components/nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="multiverse-page min-h-screen w-full lg:flex">
      <Nav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
