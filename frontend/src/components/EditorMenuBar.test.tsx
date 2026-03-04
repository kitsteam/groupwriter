import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderCommentButtons } from './EditorMenuBar';
import { LocalDocumentUser } from '../utils/localstorage';

/**
 * These tests target the NEW behavior where renderCommentButtons accepts
 * an addLocalEditingId callback in the options object. When a comment is created:
 *   1. A commentId is pre-generated (uuidv4)
 *   2. addLocalEditingId(commentId) is called
 *   3. editor.commands.setComment receives that same commentId
 *
 * Currently, renderCommentButtons does NOT accept addLocalEditingId,
 * and it does NOT pre-generate a commentId. These tests should FAIL
 * until the implementation is refactored.
 */

// Mock uuid to return a predictable value so we can assert the exact ID
vi.mock('uuid', () => ({
  v4: () => 'generated-uuid-1234'
}));

vi.mock('../utils/userColors', () => ({
  getAwarenessColor: () => ({
    id: 'red',
    bgClass: 'bg-red-300',
    textClass: 'text-red-300',
    bgSelectionClass: 'bg-red-200'
  })
}));

// Suppress i18next
const mockT = ((key: string) => key) as never;

// Build a minimal editor-like object without importing the real Editor class
const createEditorMock = () => ({
  isActive: vi.fn().mockReturnValue(false),
  state: {
    selection: { empty: false }
  },
  commands: {
    setComment: vi.fn()
  },
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      unsetComment: vi.fn().mockReturnValue({
        run: vi.fn()
      })
    })
  })
});

describe('renderCommentButtons with addLocalEditingId', () => {
  let editorMock: ReturnType<typeof createEditorMock>;
  let currentUser: LocalDocumentUser;
  let setMobileCommentMenuOpen: (state: boolean) => void;
  let addLocalEditingId: (id: string) => void;

  beforeEach(() => {
    editorMock = createEditorMock();

    currentUser = {
      userId: 'user-1',
      documentId: 'doc-1',
      name: 'Alice',
      colorId: 'red'
    };

    setMobileCommentMenuOpen = vi.fn<(state: boolean) => void>();
    addLocalEditingId = vi.fn<(id: string) => void>();
  });

  it('calls addLocalEditingId with the generated commentId when creating a comment', () => {
    // The new options signature includes addLocalEditingId
    const buttons = renderCommentButtons(
      editorMock as never,
      currentUser,
      setMobileCommentMenuOpen,
      mockT,
      { addLocalEditingId }
    );

    // Render the comment button (first button in the array)
    render(<div>{buttons[0]}</div>);

    const commentButton = screen.getByTitle('menuBar.buttons.comment');
    fireEvent.click(commentButton);

    expect(addLocalEditingId).toHaveBeenCalledWith('generated-uuid-1234');
  });

  it('passes the pre-generated commentId to editor.commands.setComment', () => {
    const buttons = renderCommentButtons(
      editorMock as never,
      currentUser,
      setMobileCommentMenuOpen,
      mockT,
      { addLocalEditingId }
    );

    render(<div>{buttons[0]}</div>);

    const commentButton = screen.getByTitle('menuBar.buttons.comment');
    fireEvent.click(commentButton);

    expect(editorMock.commands.setComment).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: 'generated-uuid-1234'
      })
    );
  });
});
