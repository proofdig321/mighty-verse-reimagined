import Nav from "@/components/nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="ml-56">{children}</div>
    </div>
  );
}
