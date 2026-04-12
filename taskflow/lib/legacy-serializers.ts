import type {
  Attachment,
  Board,
  BoardActivity,
  Card,
  CardActivity,
  CardCover,
  CardDate,
  CardMember,
  Checklist,
  ChecklistItem,
  Label,
  List,
  User,
} from "@prisma/client";

type CardPayload = Card & {
  labels: Label[];
  members: CardMember[];
  attachments: Attachment[];
  activities: CardActivity[];
  checklists: (Checklist & { items: ChecklistItem[] })[];
  date: CardDate | null;
  cover: CardCover | null;
};

type ListPayload = List & {
  cards: CardPayload[];
};

type BoardPayload = Board & {
  lists: ListPayload[];
  activity: BoardActivity[];
  members: {
    user: User;
    role: string;
  }[];
};

export const toLegacyCard = (card: CardPayload, boardId: string, listTitle: string) => ({
  _id: card.id,
  title: card.title,
  description: card.description,
  owner: card.listId,
  listId: card.listId,
  boardId,
  listTitle,
  labels: card.labels.map((label) => ({
    _id: label.id,
    text: label.text,
    color: label.color,
    backColor: label.backColor,
    selected: label.selected,
  })),
  members: card.members.map((member) => ({
    user: member.userId,
    name: member.name,
    color: member.color,
  })),
  watchers: [],
  activities: card.activities.map((activity) => ({
    _id: activity.id,
    userName: activity.userName,
    text: activity.text,
    date: activity.createdAt,
    isComment: activity.isComment,
    color: activity.color,
  })),
  checklists: card.checklists.map((checklist) => ({
    _id: checklist.id,
    title: checklist.title,
    items: checklist.items.map((item) => ({
      _id: item.id,
      text: item.text,
      completed: item.completed,
    })),
  })),
  date: {
    startDate: card.date?.startDate ?? null,
    dueDate: card.date?.dueDate ?? null,
    dueTime: card.date?.dueTime ?? null,
    completed: card.date?.completed ?? false,
  },
  attachments: card.attachments.map((attachment) => ({
    _id: attachment.id,
    link: attachment.link,
    name: attachment.name,
    date: attachment.createdAt,
  })),
  cover: {
    color: card.cover?.color ?? null,
    isSizeOne: card.cover?.isSizeOne ?? null,
  },
});

export const toLegacyList = (list: ListPayload, boardId: string) => ({
  _id: list.id,
  title: list.title,
  owner: list.boardId,
  cards: list.cards
    .sort((a, b) => a.position - b.position)
    .map((card) => toLegacyCard(card, boardId, list.title)),
});

export const toLegacyBoard = (board: BoardPayload) => ({
  _id: board.id,
  title: board.title,
  isImage: board.isImage,
  backgroundImageLink: board.backgroundImageLink,
  description: board.description,
  lists: board.lists.sort((a, b) => a.position - b.position).map((list) => list.id),
  members: board.members.map((member) => ({
    user: member.user.id,
    name: member.user.name,
    surname: member.user.surname,
    email: member.user.email,
    role: member.role,
    color: member.user.color,
  })),
  activity: board.activity
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((activity) => ({
      _id: activity.id,
      user: activity.userId,
      name: activity.name,
      action: activity.action,
      date: activity.createdAt,
      edited: activity.edited,
      cardTitle: activity.cardTitle,
      actionType: activity.actionType,
      color: activity.color,
    })),
  createdAt: board.createdAt,
  updatedAt: board.updatedAt,
});
