type StoryboardWorkspaceLayoutProps = {
  left: React.ReactNode;
  main: React.ReactNode;
};

export function StoryboardWorkspaceLayout({ left, main }: StoryboardWorkspaceLayoutProps) {
  return (
    <div className="studio-unified-workspace">
      {left}
      {main}
    </div>
  );
}
