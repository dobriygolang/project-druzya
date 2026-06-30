import {
  boardsStoreCreate,
  boardsStoreDelete,
  boardsStoreGet,
  boardsStoreList,
  boardsStoreUpdateScene,
  boardsStoreUpdateTitle,
  type Board,
  type BoardSummary,
} from '@features/whiteboard/repository/whiteboardStore';

export type { Board, BoardSummary };

export async function listBoards(): Promise<BoardSummary[]> {
  return boardsStoreList();
}

export async function getBoard(id: string): Promise<Board> {
  const board = await boardsStoreGet(id);
  if (!board) throw new Error(`Board not found: ${id}`);
  return board;
}

export async function createBoard(title = 'Untitled'): Promise<Board> {
  return boardsStoreCreate(title);
}

export async function updateBoardScene(id: string, sceneJson: string): Promise<Board> {
  return boardsStoreUpdateScene(id, sceneJson);
}

export async function updateBoardTitle(id: string, title: string): Promise<Board> {
  return boardsStoreUpdateTitle(id, title);
}

export async function deleteBoard(id: string): Promise<void> {
  await boardsStoreDelete(id);
}
