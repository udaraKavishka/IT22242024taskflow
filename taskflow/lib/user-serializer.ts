import type { User } from "@prisma/client";

import { toLegacyUser } from "@/lib/mappers";

export const serializeUserWithBoards = (
  user: User & {
    boards: {
      board: {
        id: string;
        title: string;
        isImage: boolean;
        backgroundImageLink: string;
        description: string;
      };
    }[];
  },
  token?: string
) => {
  return toLegacyUser({
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    avatar: user.avatar,
    color: user.color,
    token,
    boards: user.boards.map((entry) => ({
      _id: entry.board.id,
      title: entry.board.title,
      isImage: entry.board.isImage,
      backgroundImageLink: entry.board.backgroundImageLink,
      description: entry.board.description,
    })),
  });
};
