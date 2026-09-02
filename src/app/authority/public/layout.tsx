import Nav from "@/components/nav";

export default function AuthorityPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div className="ml-56 min-h-screen">{children}</div>
    </>
  );
}
