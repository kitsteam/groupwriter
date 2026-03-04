import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { UserContext, UserContextType } from '../contexts/UserContext';
import {
  CommentItem,
  MarkWithPos
} from '@packages/tiptap-extension-comment-collaboration';

/**
 * These tests target the NEW localEditingIds-based behavior.
 * They should FAIL against the current implementation which uses
 * the synced formula: comment.text === null && currentUser?.userId === comment.user.id
 *
 * After refactoring, CommentsList will accept:
 *   - localEditingIds: Set<string>
 *   - removeLocalEditingId: (id: string) => void
 *
 * And toBeEdited will be: localEditingIds.has(commentId)
 */

// Mock CommentCard to inspect the props passed to it
vi.mock('./CommentCard', () => ({
  default: (props: {
    comment: CommentItem;
    toBeEdited: boolean;
    isLastClicked: boolean;
    activated: boolean;
    absoluteTop: number;
    removeLocalEditingId?: (id: string) => void;
  }) => (
    <div
      data-testid={`comment-card-${props.comment.commentId}`}
      data-to-be-edited={String(props.toBeEdited)}
      data-is-last-clicked={String(props.isLastClicked)}
      data-has-remove-handler={String(
        typeof props.removeLocalEditingId === 'function'
      )}
    >
      {props.comment.commentId}
    </div>
  )
}));

const createMockComment = (
  overrides: Partial<CommentItem> = {}
): CommentItem => ({
  commentId: 'comment-1',
  commentType: 'comment',
  text: null,
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

const createMockMarkPos = (
  commentId: string,
  top = 100
): MarkWithPos => ({
  commentId,
  range: { from: 0, to: 10 },
  coords: { left: 0, right: 100, top, bottom: top + 20 }
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

describe('CommentsList with localEditingIds', () => {
  // Use a minimal object as editor mock -- CommentsList only passes it through
  const editorMock = {} as never;

  // Dynamically import to get the real module (not blocked by vi.mock('@tiptap/core'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let EditorComments: any;

  beforeEach(async () => {
    const mod = await import('./CommentsList');
    EditorComments = mod.default;
  });

  it('sets toBeEdited to true when localEditingIds contains the comment ID', () => {
    const comment = createMockComment({ commentId: 'comment-1', text: null });
    const comments: Record<string, CommentItem> = { 'comment-1': comment };
    const markPos: Record<string, MarkWithPos> = {
      'comment-1': createMockMarkPos('comment-1')
    };
    const localEditingIds = new Set(['comment-1']);

    render(
      <UserContext.Provider value={userContextValue}>
        <EditorComments
          comments={comments}
          markPos={markPos}
          editor={editorMock}
          activatedComment={null}
          localEditingIds={localEditingIds}
          removeLocalEditingId={vi.fn()}
        />
      </UserContext.Provider>
    );

    const card = screen.getByTestId('comment-card-comment-1');
    expect(card).toHaveAttribute('data-to-be-edited', 'true');
  });

  it('sets toBeEdited to false when localEditingIds does NOT contain the comment ID', () => {
    const comment = createMockComment({
      commentId: 'comment-2',
      text: null
    });
    const comments: Record<string, CommentItem> = { 'comment-2': comment };
    const markPos: Record<string, MarkWithPos> = {
      'comment-2': createMockMarkPos('comment-2')
    };
    const localEditingIds = new Set<string>();

    render(
      <UserContext.Provider value={userContextValue}>
        <EditorComments
          comments={comments}
          markPos={markPos}
          editor={editorMock}
          activatedComment={null}
          localEditingIds={localEditingIds}
          removeLocalEditingId={vi.fn()}
        />
      </UserContext.Provider>
    );

    const card = screen.getByTestId('comment-card-comment-2');
    expect(card).toHaveAttribute('data-to-be-edited', 'false');
  });

  it('sets toBeEdited to false even when text is null and currentUser matches (old synced formula removed)', () => {
    // This is the critical test: the OLD formula would return true here,
    // but with localEditingIds the result should be false because the ID
    // is not in the set.
    const comment = createMockComment({
      commentId: 'comment-3',
      text: null,
      user: { id: 'user-1', username: 'Alice' }
    });
    const comments: Record<string, CommentItem> = { 'comment-3': comment };
    const markPos: Record<string, MarkWithPos> = {
      'comment-3': createMockMarkPos('comment-3')
    };
    // localEditingIds intentionally empty -- the old formula would have said "edit"
    const localEditingIds = new Set<string>();

    render(
      <UserContext.Provider value={userContextValue}>
        <EditorComments
          comments={comments}
          markPos={markPos}
          editor={editorMock}
          activatedComment={null}
          localEditingIds={localEditingIds}
          removeLocalEditingId={vi.fn()}
        />
      </UserContext.Provider>
    );

    const card = screen.getByTestId('comment-card-comment-3');
    expect(card).toHaveAttribute('data-to-be-edited', 'false');
  });

  it('sets lastClickedCommentId for comments present in localEditingIds', async () => {
    // When a comment is in localEditingIds, the auto-focus useEffect should
    // set lastClickedCommentId so that isLastClicked is true for that card
    const comment = createMockComment({
      commentId: 'comment-4',
      text: null
    });
    const comments: Record<string, CommentItem> = { 'comment-4': comment };
    const markPos: Record<string, MarkWithPos> = {
      'comment-4': createMockMarkPos('comment-4')
    };
    const localEditingIds = new Set(['comment-4']);

    render(
      <UserContext.Provider value={userContextValue}>
        <EditorComments
          comments={comments}
          markPos={markPos}
          editor={editorMock}
          activatedComment={null}
          localEditingIds={localEditingIds}
          removeLocalEditingId={vi.fn()}
        />
      </UserContext.Provider>
    );

    // The auto-focus useEffect should mark comment-4 as last clicked
    const card = await screen.findByTestId('comment-card-comment-4');
    expect(card).toHaveAttribute('data-is-last-clicked', 'true');
  });
});
