import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import CommentCard from './CommentCard';
import { UserContext, UserContextType } from '../contexts/UserContext';
import { EditorContext, EditorContextType } from '../contexts/EditorContext';
import { CommentItem } from '@packages/tiptap-extension-comment-collaboration';

/**
 * These tests target the NEW behavior where CommentCard receives
 * a removeLocalEditingId callback prop. On save or abort, the component
 * must call removeLocalEditingId(commentId) to clean up the tab-local
 * editing state.
 *
 * Tests 5-6 verify the existing toBeEdited prop behavior.
 * Tests 7-8 verify the NEW removeLocalEditingId callback (should FAIL until implemented).
 */

// Suppress i18next warnings in tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'buttons.save': 'Save',
        'buttons.abort': 'Abort',
        'commentCard.buttons.edit': 'Edit',
        'commentCard.buttons.delete': 'Delete',
        'commentCard.buttons.acceptProposal': 'Accept'
      };
      return translations[key] ?? key;
    }
  })
}));

const createMockComment = (
  overrides: Partial<CommentItem> = {}
): CommentItem => ({
  commentId: 'comment-abc',
  commentType: 'comment',
  text: 'Some comment text',
  draft: false,
  resolved: false,
  parentId: null,
  colorClass: 'bg-red-300',
  user: { id: 'user-1', username: 'Alice' },
  updatedBy: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides
});

const currentUser = {
  userId: 'user-1',
  documentId: 'doc-1',
  name: 'Alice',
  colorId: 'red'
};

const userContextValue: UserContextType = {
  currentUser,
  storeUserSetting: vi.fn()
};

const editorContextValue: EditorContextType = {
  modificationSecret: 'secret',
  readOnly: false,
  documentId: 'doc-1'
};

const renderWithContexts = (ui: React.ReactElement) => {
  return render(
    <UserContext.Provider value={userContextValue}>
      <EditorContext.Provider value={editorContextValue}>
        {ui}
      </EditorContext.Provider>
    </UserContext.Provider>
  );
};

// Build a minimal editor-like object without importing the real Editor class
// (which has getter-only properties that cannot be overridden).
const createEditorMock = () => ({
  commands: {
    commentRemove: vi.fn(),
    commentUpdate: vi.fn()
  }
});

describe('CommentCard', () => {
  let editorMock: ReturnType<typeof createEditorMock>;
  let setLastClickedCommentId: (commentId: string | null) => void;
  let removeLocalEditingId: (id: string) => void;

  beforeEach(() => {
    editorMock = createEditorMock();
    setLastClickedCommentId = vi.fn<(commentId: string | null) => void>();
    removeLocalEditingId = vi.fn<(id: string) => void>();
  });

  it('opens in edit mode when toBeEdited is true', () => {
    const comment = createMockComment({ text: null });

    renderWithContexts(
      <CommentCard
        editor={editorMock as never}
        comment={comment}
        setLastClickedCommentId={setLastClickedCommentId}
        activated={false}
        isLastClicked={true}
        absoluteTop={100}
        toBeEdited={true}
        removeLocalEditingId={removeLocalEditingId}
      />
    );

    // When toBeEdited is true, the textarea (editing mode) should be visible
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does NOT open in edit mode when toBeEdited is false', () => {
    const comment = createMockComment({ text: 'Existing text' });

    renderWithContexts(
      <CommentCard
        editor={editorMock as never}
        comment={comment}
        setLastClickedCommentId={setLastClickedCommentId}
        activated={false}
        isLastClicked={false}
        absoluteTop={100}
        toBeEdited={false}
        removeLocalEditingId={removeLocalEditingId}
      />
    );

    // When toBeEdited is false, no textarea should be rendered
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('calls removeLocalEditingId with the comment ID on save', () => {
    const comment = createMockComment({
      commentId: 'comment-save-test',
      text: null
    });

    renderWithContexts(
      <CommentCard
        editor={editorMock as never}
        comment={comment}
        setLastClickedCommentId={setLastClickedCommentId}
        activated={false}
        isLastClicked={true}
        absoluteTop={100}
        toBeEdited={true}
        removeLocalEditingId={removeLocalEditingId}
      />
    );

    // The comment is in editing mode (toBeEdited=true), so Save button is visible
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(removeLocalEditingId).toHaveBeenCalledWith('comment-save-test');
  });

  it('calls removeLocalEditingId with the comment ID on abort', () => {
    const comment = createMockComment({
      commentId: 'comment-abort-test',
      text: null
    });

    renderWithContexts(
      <CommentCard
        editor={editorMock as never}
        comment={comment}
        setLastClickedCommentId={setLastClickedCommentId}
        activated={false}
        isLastClicked={true}
        absoluteTop={100}
        toBeEdited={true}
        removeLocalEditingId={removeLocalEditingId}
      />
    );

    // The comment is in editing mode (toBeEdited=true), so Abort button is visible
    const abortButton = screen.getByText('Abort');
    fireEvent.click(abortButton);

    expect(removeLocalEditingId).toHaveBeenCalledWith('comment-abort-test');
  });
});
