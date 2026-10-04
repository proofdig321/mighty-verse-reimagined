type StoryboardWorkspaceLayoutProps = {
  left: React.ReactNode;
  main: React.ReactNode;
};

export function StoryboardWorkspaceLayout({ left, main }: StoryboardWorkspaceLayoutProps) {
  return (
    <div className="studio-workbench">
      <div className="studio-workbench-rail">{left}</div>
      <div className="studio-workbench-main">{main}</div>
    </div>
  );
}
