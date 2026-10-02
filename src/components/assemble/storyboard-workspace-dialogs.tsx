import { StoryboardDeleteDialog } from "./storyboard-delete-dialog";
import { StoryboardResetDialog } from "./storyboard-reset-dialog";
import type { ResetScope } from "@/lib/storyboard/mutations";

type StoryboardWorkspaceDialogsProps = {
  resetOpen: boolean;
  deleteOpen: boolean;
  deleteBusy: boolean;
  deleteError: string | null;
  workTitle: string;
  workAttached: boolean;
  panelSelected: boolean;
  onResetClose: () => void;
  onResetConfirm: (scope: ResetScope) => void;
  onDeleteClose: () => void;
  onDeleteConfirm: () => void;
};

export function StoryboardWorkspaceDialogs({
  resetOpen,
  deleteOpen,
  deleteBusy,
  deleteError,
  workTitle,
  workAttached,
  panelSelected,
  onResetClose,
  onResetConfirm,
  onDeleteClose,
  onDeleteConfirm,
}: StoryboardWorkspaceDialogsProps) {
  return (
    <>
      <StoryboardResetDialog
        open={resetOpen}
        panelSelected={panelSelected}
        onClose={onResetClose}
        onConfirm={onResetConfirm}
      />
      <StoryboardDeleteDialog
        open={deleteOpen}
        title={workTitle}
        attached={workAttached}
        busy={deleteBusy}
        error={deleteError}
        onClose={onDeleteClose}
        onConfirm={onDeleteConfirm}
      />
    </>
  );
}
